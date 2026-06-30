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

interface ISpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
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
}

interface IWindowWithSpeechRecognition extends Window {
    SpeechRecognition?: ISpeechRecognitionConstructor;
    webkitSpeechRecognition?: ISpeechRecognitionConstructor;
}

// Browsers end recognition sessions on their own (e.g. after silence), so wait a moment and restart
const restartDelayInMs = 250;

function getSpeechRecognitionConstructor(): ISpeechRecognitionConstructor | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }

    const speechWindow: IWindowWithSpeechRecognition = window as IWindowWithSpeechRecognition;
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

/**
 * Speech engine backed by the browser's native Web Speech API (Chrome/Edge/Safari). Chromium browsers send the
 * audio to an online speech service, so this needs an internet connection.
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

    constructor(callbacks: ISpeechEngineCallbacks) {
        this.callbacks = callbacks;
        this.recognition = undefined;
        this.active = false;
        this.restartTimerId = undefined;
        this.sessionId = 0;
    }

    public static isSupported(): boolean {
        return getSpeechRecognitionConstructor() != undefined;
    }

    public start(): void {
        this.stop();

        const speechRecognitionConstructor: ISpeechRecognitionConstructor | undefined =
            getSpeechRecognitionConstructor();
        if (speechRecognitionConstructor == undefined) {
            this.callbacks.onPermanentError("Speech recognition isn't supported in this browser.");
            return;
        }

        this.active = true;
        this.startRecognitionSession(speechRecognitionConstructor);
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

    private startRecognitionSession(speechRecognitionConstructor: ISpeechRecognitionConstructor): void {
        this.sessionId++;

        const recognition: ISpeechRecognition = new speechRecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = document.documentElement.lang || "en-US";
        recognition.onstart = () => this.callbacks.onStatusChanged("Listening");
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
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            this.stop();
            this.callbacks.onPermanentError(
                "Couldn't access the microphone. Allow microphone access in your browser to track the reading position."
            );
            return;
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

        // Restart after a short delay so a persistent failure doesn't turn into a tight loop
        this.restartTimerId = window.setTimeout(() => {
            this.restartTimerId = undefined;
            if (!this.active) {
                return;
            }

            const speechRecognitionConstructor: ISpeechRecognitionConstructor | undefined =
                getSpeechRecognitionConstructor();
            if (speechRecognitionConstructor != undefined) {
                this.startRecognitionSession(speechRecognitionConstructor);
            }
        }, restartDelayInMs);
    }
}
