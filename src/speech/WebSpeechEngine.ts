import { ISpeechEngine, ISpeechEngineCallbacks } from "./SpeechEngine";

// The Web Speech API isn't in TypeScript's dom library yet, so declare the small surface area we use
interface ISpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface ISpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    [index: number]: ISpeechRecognitionAlternative;
}

interface ISpeechRecognitionResultList {
    length: number;
    [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionEvent {
    resultIndex: number;
    results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent {
    error: string;
}

interface ISpeechRecognitionPhrase {
    readonly phrase: string;
    readonly boost: number;
}

interface ISpeechRecognitionPhraseConstructor {
    new (phrase: string, boost?: number): ISpeechRecognitionPhrase;
}

interface ISpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;

    // Newer Chromium only: on-device recognition, and contextual biasing (which only works on-device)
    processLocally?: boolean;
    phrases?: ISpeechRecognitionPhrase[];

    onend: (() => void) | null;
    onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
    onresult: ((event: ISpeechRecognitionEvent) => void) | null;
    onstart: (() => void) | null;
    abort(): void;
    start(): void;
    stop(): void;
}

interface ISpeechRecognitionConstructor {
    new (): ISpeechRecognition;
    available?(options: { langs: string[]; processLocally: boolean }): Promise<string>;
    install?(options: { langs: string[]; processLocally: boolean }): Promise<boolean>;
}

interface IWindowWithSpeechRecognition extends Window {
    SpeechRecognition?: ISpeechRecognitionConstructor;
    webkitSpeechRecognition?: ISpeechRecognitionConstructor;
    SpeechRecognitionPhrase?: ISpeechRecognitionPhraseConstructor;
}

// Browsers end recognition sessions on their own (after silence, or after a minute or so), and every moment
// between sessions is speech we don't hear. Restart a session that ran normally right away; back off only when
// sessions keep failing immediately, so a persistent failure doesn't turn into a tight loop.
const healthySessionDurationInMs = 2000;
const initialRestartBackoffInMs = 250;
const maximumRestartBackoffInMs = 4000;

// Which tossup words to bias recognition toward, and how much. Long words are the names and terms a recognizer
// is most likely to get wrong without a hint.
const maximumBiasPhrases = 100;
const biasPhraseMinimumLength = 5;
const biasPhraseBoost = 3;

function getSpeechRecognitionConstructor(): ISpeechRecognitionConstructor | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }

    const speechWindow: IWindowWithSpeechRecognition = window as IWindowWithSpeechRecognition;
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function getSpeechRecognitionPhraseConstructor(): ISpeechRecognitionPhraseConstructor | undefined {
    return typeof window === "undefined" ? undefined : (window as IWindowWithSpeechRecognition).SpeechRecognitionPhrase;
}

function getLanguage(): string {
    return document.documentElement.lang || "en-US";
}

/**
 * Speech engine backed by the browser's native Web Speech API (Chrome/Edge/Safari). Chromium browsers send the
 * audio to an online speech service, unless an on-device model is installed; then that's used instead, since it
 * has less latency and supports biasing recognition toward the tossup's words.
 */
export class WebSpeechEngine implements ISpeechEngine {
    public readonly name: string = "Web Speech API";

    private readonly callbacks: ISpeechEngineCallbacks;

    private recognition: ISpeechRecognition | undefined;

    private active: boolean;

    private restartTimerId: number | undefined;

    // Recognition sessions restart, and each session numbers its results from 0 again, so include a session
    // counter in utterance keys
    private sessionId: number;

    private sessionStartTime: number;

    private restartBackoffInMs: number;

    // Whether recognition runs on-device; decided once when listening starts
    private processLocally: boolean;

    // Set if the recognizer rejected bias phrases, so we stop sending them
    private phrasesUnsupported: boolean;

    private vocabulary: string[];

    constructor(callbacks: ISpeechEngineCallbacks) {
        this.callbacks = callbacks;
        this.recognition = undefined;
        this.active = false;
        this.restartTimerId = undefined;
        this.sessionId = 0;
        this.sessionStartTime = 0;
        this.restartBackoffInMs = initialRestartBackoffInMs;
        this.processLocally = false;
        this.phrasesUnsupported = false;
        this.vocabulary = [];
    }

    public static isSupported(): boolean {
        return getSpeechRecognitionConstructor() != undefined;
    }

    /** Whether the browser can download an on-device recognition model (newer Chromium) */
    public static canInstallOnDeviceModel(): boolean {
        return getSpeechRecognitionConstructor()?.install != undefined;
    }

    /**
     * Downloads the on-device recognition model, which is used from the next session on. Browsers require this to
     * be called while handling a user action (e.g. a click). Resolves to whether the model was installed.
     */
    public static installOnDeviceModel(): Promise<boolean> {
        const speechRecognitionConstructor:
            | ISpeechRecognitionConstructor
            | undefined = getSpeechRecognitionConstructor();
        if (speechRecognitionConstructor?.install == undefined) {
            return Promise.resolve(false);
        }

        try {
            return speechRecognitionConstructor
                .install({ langs: [getLanguage()], processLocally: true })
                .catch(() => false);
        } catch (e) {
            return Promise.resolve(false);
        }
    }

    public start(): void {
        this.stop();

        const speechRecognitionConstructor:
            | ISpeechRecognitionConstructor
            | undefined = getSpeechRecognitionConstructor();
        if (speechRecognitionConstructor == undefined) {
            this.callbacks.onPermanentError("Speech recognition isn't supported in this browser.");
            return;
        }

        this.active = true;
        void this.startListening(speechRecognitionConstructor);
    }

    public stop(): void {
        this.active = false;

        if (this.restartTimerId != undefined) {
            window.clearTimeout(this.restartTimerId);
            this.restartTimerId = undefined;
        }

        if (this.recognition != undefined) {
            this.recognition.onresult = null;
            this.recognition.onerror = null;
            this.recognition.onend = null;
            this.recognition.onstart = null;
            try {
                this.recognition.abort();
            } catch (e) {
                // The session could've already stopped; we don't care at this point
            }

            this.recognition = undefined;
        }
    }

    public setVocabulary(words: string[]): void {
        this.vocabulary = words;

        // Bias phrases only take effect when a session starts. Restarting costs a moment of audio, so only do it
        // when the phrases will actually be used. Stopping ends the session, and handleEnd starts the next one.
        if (this.canUsePhrases() && this.recognition != undefined) {
            try {
                this.recognition.stop();
            } catch (e) {
                // The session already ended; handleEnd starts the next one with the new phrases
            }
        }
    }

    private async startListening(speechRecognitionConstructor: ISpeechRecognitionConstructor): Promise<void> {
        // Use on-device recognition if its model is already installed. Don't trigger the download ourselves.
        if (speechRecognitionConstructor.available != undefined) {
            try {
                const availability: string = await speechRecognitionConstructor.available({
                    langs: [getLanguage()],
                    processLocally: true,
                });
                this.processLocally = availability === "available";
            } catch (e) {
                this.processLocally = false;
            }
        }

        if (this.active) {
            this.startRecognitionSession(speechRecognitionConstructor);
        }
    }

    private canUsePhrases(): boolean {
        return this.processLocally && !this.phrasesUnsupported && getSpeechRecognitionPhraseConstructor() != undefined;
    }

    private startRecognitionSession(speechRecognitionConstructor: ISpeechRecognitionConstructor): void {
        this.sessionId++;
        this.sessionStartTime = Date.now();

        const recognition: ISpeechRecognition = new speechRecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = getLanguage();
        if (this.processLocally) {
            recognition.processLocally = true;
        }

        const phraseConstructor:
            | ISpeechRecognitionPhraseConstructor
            | undefined = getSpeechRecognitionPhraseConstructor();
        if (this.canUsePhrases() && phraseConstructor != undefined) {
            try {
                recognition.phrases = this.vocabulary
                    .filter((word) => word.length >= biasPhraseMinimumLength)
                    .slice(0, maximumBiasPhrases)
                    .map((word) => new phraseConstructor(word, biasPhraseBoost));
            } catch (e) {
                this.phrasesUnsupported = true;
            }
        }

        recognition.onstart = () =>
            this.callbacks.onStatusChanged(
                this.processLocally ? "Listening (on-device)" : "Listening (online service)"
            );
        recognition.onresult = (event) => this.handleResult(event);
        recognition.onerror = (event) => this.handleError(event);
        recognition.onend = () => this.handleEnd();

        this.recognition = recognition;
        this.callbacks.onStatusChanged("Starting recognition session...");

        try {
            recognition.start();
        } catch (e) {
            // start() throws if the session is already running, which means we're already listening
        }
    }

    private handleResult(event: ISpeechRecognitionEvent): void {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result: ISpeechRecognitionResult = event.results[i];
            const utteranceKey = `${this.sessionId}-${i}`;
            const transcript: string = result[0].transcript;

            if (result.isFinal) {
                this.callbacks.onFinalTranscript(utteranceKey, transcript);
            } else {
                this.callbacks.onPartialTranscript(utteranceKey, transcript);
            }
        }
    }

    private handleError(event: ISpeechRecognitionErrorEvent): void {
        if (event.error === "not-allowed") {
            this.stop();
            this.callbacks.onPermanentError(
                "Couldn't access the microphone. Allow microphone access in your browser to track the reading position."
            );
            return;
        }

        // Safari reports this when speech recognition itself is turned off (it relies on Siri/Dictation), or when
        // its speech recognition permission was denied
        if (event.error === "service-not-allowed") {
            this.stop();
            this.callbacks.onPermanentError(
                "Speech recognition isn't allowed. Allow microphone and speech recognition access in your browser. " +
                    "In Safari, also make sure Siri or Dictation is turned on in System Settings."
            );
            return;
        }

        // The microphone couldn't be captured, which can happen when another capture of it is running (Safari,
        // particularly on iOS, handles two at once poorly)
        if (event.error === "audio-capture") {
            this.callbacks.onAudioCaptureError?.();
        }

        if (event.error === "phrases-not-supported") {
            this.phrasesUnsupported = true;
        }

        // Transient errors (no-speech, network, audio-capture, aborted) end the session, and handleEnd
        // restarts it. Surface them so the debug window shows what's happening.
        this.callbacks.onStatusChanged(`Recognition error: ${event.error}`);
    }

    private handleEnd(): void {
        if (!this.active) {
            return;
        }

        this.callbacks.onStatusChanged("Recognition session ended; restarting...");

        // A session that ran normally ended on its own (silence, time limit, or a vocabulary change); restart
        // right away. One that ended almost immediately is failing, so wait longer each time.
        let delayInMs = 0;
        if (Date.now() - this.sessionStartTime >= healthySessionDurationInMs) {
            this.restartBackoffInMs = initialRestartBackoffInMs;
        } else {
            delayInMs = this.restartBackoffInMs;
            this.restartBackoffInMs = Math.min(maximumRestartBackoffInMs, this.restartBackoffInMs * 2);
        }

        this.restartTimerId = window.setTimeout(() => {
            this.restartTimerId = undefined;
            if (!this.active) {
                return;
            }

            const speechRecognitionConstructor:
                | ISpeechRecognitionConstructor
                | undefined = getSpeechRecognitionConstructor();
            if (speechRecognitionConstructor != undefined) {
                this.startRecognitionSession(speechRecognitionConstructor);
            }
        }, delayInMs);
    }
}
