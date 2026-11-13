import { ISpeechEngine, ISpeechEngineCallbacks } from "./SpeechEngine";
import { tokenizeSpeechText } from "./SpeechText";
import {
    IProcessResult,
    normalizeSpokenWord,
    TranscriptAligner,
    UtteranceTranscriptProcessor,
} from "./TranscriptAligner";
import { logReadAlong } from "./ReadAlongLog";
import { VoskSpeechEngine } from "./VoskSpeechEngine";
import { isBraveBrowser, WebSpeechEngine } from "./WebSpeechEngine";

// Words the moderator says right after a buzz is resolved ("correct", "neg 5", "power, 15 points"). Hearing one
// means a buzz just happened, so the buzz point should update right away instead of waiting for a pause.
// Recognizers write numbers as digits or words depending on context, so include both forms.
export const buzzResolutionWords: ReadonlySet<string> = new Set([
    "correct",
    "incorrect",
    "power",
    "neg",
    "15",
    "fifteen",
    "10",
    "ten",
]);

// The most recent words of a transcript shown in the debug window
const maximumDisplayedTranscriptWords = 40;

// A recognizer that has heard nothing for this long when a new tossup comes up is restarted (see restartIfIdle)
const idleRestartInMs = 10000;

export interface IReaderFollowerCallbacks {
    /** Called when we believe the reader has read up to (and including) the given word index. */
    onPositionChanged(wordIndex: number): void;

    /** Called when listening can't continue (e.g. microphone access was denied). */
    onPermanentError(message: string): void;

    /** Optional: the speech engine couldn't capture the microphone, e.g. because something else is using it. */
    onAudioCaptureError?(): void;

    /**
     * Optional: called when the moderator says a word that signals a buzz was just resolved ("correct",
     * "incorrect", "power", "neg", point values). Fired once per heard word.
     */
    onBuzzResolutionWord?(word: string): void;

    /** Optional diagnostics: the engine's state changed (e.g. listening, restarting, errors). */
    onStatusChanged?(engineName: string, status: string): void;

    /** Optional diagnostics: the latest transcript heard from the microphone. */
    onTranscript?(transcript: string): void;
}

// Use the local recognizer rather than the browser's: from the start in Brave (its SpeechRecognition has no service
// behind it), and from the moment the browser's service is found unreachable anywhere else.
let useLocalEngine: boolean = isBraveBrowser();

/**
 * Passively listens to the microphone and reports how far into a known piece of text (a tossup) the speaker has
 * read. Positions are word indexes into the target words passed to `setTargetWords`, and once the last of them
 * has been read, the index just past it (`targetWords.length`): the end of the question, where a buzz after the
 * whole tossup has been read belongs -- MODAQ's END marker, not the last word.
 *
 * Listening is started once and kept running while the target changes from tossup to tossup, so no words are
 * lost to recognizer start-up at the beginning of each question.
 *
 * Uses the native Web Speech API when the browser has one (Chrome/Edge/Safari), and a local WebAssembly
 * recognizer (Vosk) otherwise: in browsers without it, like Firefox; in Brave, whose API has no speech service
 * behind it; and wherever the browser's speech service turns out to be unreachable.
 */
export class ReaderFollower {
    private readonly callbacks: IReaderFollowerCallbacks;

    private engine: ISpeechEngine | undefined;

    // Undefined while there's no tossup to follow (e.g. during a bonus); transcripts are then ignored
    private processor: UtteranceTranscriptProcessor | undefined;

    // The utterance in progress when the target last changed, and how many of its words were heard before the
    // change. Those words belong to the previous question (or chatter between questions), not the new target.
    private ignoredUtterance: { key: string; wordCount: number } | undefined;

    private lastUtterance: { key: string; wordCount: number } | undefined;

    // How many target words there are, so reading the last one reports the end of the question
    private targetWordCount: number;

    // The words last handed to the engine, so an engine switched in mid-tossup gets them too
    private vocabulary: string[] | undefined;

    constructor(callbacks: IReaderFollowerCallbacks) {
        this.targetWordCount = 0;
        this.vocabulary = undefined;
        this.callbacks = callbacks;
        this.engine = undefined;
        this.processor = undefined;
        this.ignoredUtterance = undefined;
        this.lastUtterance = undefined;
    }

    public static isSupported(): boolean {
        return WebSpeechEngine.isSupported() || VoskSpeechEngine.isSupported();
    }

    /**
     * Whether listening uses the browser's speech recognition, which may offer a faster on-device model (newer
     * Chrome) instead of an online service.
     */
    public static mayOfferFasterModel(): boolean {
        return WebSpeechEngine.isSupported();
    }

    /**
     * Installs the faster on-device model (call while handling a click); listening must restart to use it.
     * "unsupported" means this browser can't install one.
     */
    public static installFasterModel(): Promise<"installed" | "failed" | "unsupported"> {
        if (!WebSpeechEngine.canInstallOnDeviceModel()) {
            return Promise.resolve("unsupported");
        }

        return WebSpeechEngine.installOnDeviceModel().then((installed) => (installed ? "installed" : "failed"));
    }

    /** Starts listening. Any previous session is stopped first. */
    public start(): void {
        this.stop();

        const engineCallbacks: ISpeechEngineCallbacks = {
            onPartialTranscript: (utteranceKey, transcript) => this.handleTranscript(utteranceKey, transcript, false),
            onFinalTranscript: (utteranceKey, transcript) => this.handleTranscript(utteranceKey, transcript, true),
            onStatusChanged: (status) => {
                logReadAlong("status", status);
                if (this.callbacks.onStatusChanged != undefined && this.engine != undefined) {
                    this.callbacks.onStatusChanged(this.engine.name, status);
                }
            },
            onPermanentError: (message) => {
                this.stop();
                this.callbacks.onPermanentError(message);
            },
            onAudioCaptureError: () => this.callbacks.onAudioCaptureError?.(),
            onServiceUnavailable: () => {
                if (!VoskSpeechEngine.isSupported()) {
                    engineCallbacks.onPermanentError(
                        "The browser's speech recognition service can't be reached, and this browser can't run " +
                            "local recognition either. Try Chrome or Edge."
                    );
                    return;
                }

                // For the rest of the page's life: the service isn't coming back between tossups
                useLocalEngine = true;
                logReadAlong("engine", "browser speech service unreachable; switching to local recognition (Vosk)");
                this.startEngine(new VoskSpeechEngine(engineCallbacks));
            },
        };

        this.startEngine(
            useLocalEngine || !WebSpeechEngine.isSupported()
                ? new VoskSpeechEngine(engineCallbacks)
                : new WebSpeechEngine(engineCallbacks)
        );
    }

    private startEngine(engine: ISpeechEngine): void {
        this.engine = engine;
        logReadAlong("engine", engine.name);
        engine.start();
        if (this.vocabulary != undefined) {
            engine.setVocabulary(this.vocabulary);
        }
    }

    public stop(): void {
        if (this.engine != undefined) {
            const engine: ISpeechEngine = this.engine;
            this.engine = undefined;
            engine.stop();
        }

        this.processor = undefined;
        this.ignoredUtterance = undefined;
        this.lastUtterance = undefined;
    }

    /**
     * Follows the given words (a tossup) from the beginning, or stops following anything if `targetWords` is
     * undefined. Doesn't interrupt listening.
     */
    public setTargetWords(targetWords: string[] | undefined): void {
        logReadAlong(
            "target",
            targetWords == undefined
                ? "(none)"
                : `${targetWords.length} words: ${targetWords.slice(0, 8).join(" ")}` +
                      (this.lastUtterance != undefined
                          ? ` | ignoring ${this.lastUtterance.wordCount} words of ${this.lastUtterance.key}`
                          : "")
        );
        if (targetWords != undefined && this.engine?.restartIfIdle?.(idleRestartInMs) === true) {
            // A fresh session: nothing in progress belongs to the previous question
            this.lastUtterance = undefined;
            logReadAlong("restart", `nothing heard for ${idleRestartInMs / 1000}s`);
        }

        this.ignoredUtterance = this.lastUtterance;
        this.targetWordCount = targetWords?.length ?? 0;
        this.processor =
            targetWords == undefined ? undefined : new UtteranceTranscriptProcessor(new TranscriptAligner(targetWords));

        if (targetWords != undefined && this.engine != undefined) {
            const vocabulary: Set<string> = new Set(buzzResolutionWords);
            for (const word of targetWords) {
                for (const token of tokenizeSpeechText(word)) {
                    vocabulary.add(token);
                }
            }

            this.vocabulary = [...vocabulary];
            this.engine.setVocabulary(this.vocabulary);
        }
    }

    // The aligner only reaches the last word with the evidence it needs for any word, so the end of the question
    // follows the same way: a last word half-heard (or not yet heard) leaves the position on the word before it.
    private reportedPosition(position: number): number {
        return this.targetWordCount > 0 && position === this.targetWordCount - 1 ? this.targetWordCount : position;
    }

    private handleTranscript(utteranceKey: string, transcript: string, isFinal: boolean): void {
        let words: string[] = transcript.split(/\s+/).filter((word) => word !== "");
        this.lastUtterance = isFinal ? undefined : { key: utteranceKey, wordCount: words.length };
        logReadAlong(
            isFinal ? "final" : "heard",
            `${utteranceKey} (${words.length}) …${words.slice(-10).join(" ")}` +
                (this.processor == undefined ? " [no tossup]" : "")
        );

        if (this.processor == undefined) {
            return;
        }

        if (this.ignoredUtterance != undefined) {
            if (this.ignoredUtterance.key === utteranceKey) {
                words = words.slice(this.ignoredUtterance.wordCount);
            } else {
                this.ignoredUtterance = undefined;
            }
        }

        // Some engines (Safari's) report a long utterance as one ever-growing transcript; only show the end of it
        if (this.callbacks.onTranscript != undefined && words.length > 0) {
            this.callbacks.onTranscript(
                (words.length > maximumDisplayedTranscriptWords ? "… " : "") +
                    words.slice(-maximumDisplayedTranscriptWords).join(" ")
            );
        }

        const oldPosition: number = this.reportedPosition(this.processor.position);
        const result: IProcessResult = this.processor.process(utteranceKey, words.join(" "), isFinal);
        const newPosition: number = this.reportedPosition(result.position);
        if (newPosition !== oldPosition) {
            logReadAlong("position", `${oldPosition} -> ${newPosition}`);
            this.callbacks.onPositionChanged(newPosition);
        }

        if (this.callbacks.onBuzzResolutionWord != undefined) {
            for (const word of result.newWords) {
                if (buzzResolutionWords.has(normalizeSpokenWord(word))) {
                    this.callbacks.onBuzzResolutionWord(word);
                }
            }
        }
    }
}
