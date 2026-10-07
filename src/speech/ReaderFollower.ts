import { ISpeechEngine, ISpeechEngineCallbacks } from "./SpeechEngine";
import { tokenizeSpeechText } from "./SpeechText";
import {
    IProcessResult,
    normalizeSpokenWord,
    TranscriptAligner,
    UtteranceTranscriptProcessor,
} from "./TranscriptAligner";
import { VoskSpeechEngine } from "./VoskSpeechEngine";
import { WebSpeechEngine } from "./WebSpeechEngine";

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

/**
 * Passively listens to the microphone and reports how far into a known piece of text (a tossup) the speaker has
 * read. Positions are word indexes into the target words passed to `setTargetWords`.
 *
 * Listening is started once and kept running while the target changes from tossup to tossup, so no words are
 * lost to recognizer start-up at the beginning of each question.
 *
 * Uses the native Web Speech API when the browser has one (Chrome/Edge/Safari), and falls back to a local
 * WebAssembly recognizer (Vosk) in browsers without it, like Firefox.
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

    constructor(callbacks: IReaderFollowerCallbacks) {
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
                if (this.callbacks.onStatusChanged != undefined && this.engine != undefined) {
                    this.callbacks.onStatusChanged(this.engine.name, status);
                }
            },
            onPermanentError: (message) => {
                this.stop();
                this.callbacks.onPermanentError(message);
            },
            onAudioCaptureError: () => this.callbacks.onAudioCaptureError?.(),
        };

        this.engine = WebSpeechEngine.isSupported()
            ? new WebSpeechEngine(engineCallbacks)
            : new VoskSpeechEngine(engineCallbacks);
        this.engine.start();
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
        this.ignoredUtterance = this.lastUtterance;
        this.processor =
            targetWords == undefined ? undefined : new UtteranceTranscriptProcessor(new TranscriptAligner(targetWords));

        if (targetWords != undefined && this.engine != undefined) {
            const vocabulary: Set<string> = new Set(buzzResolutionWords);
            for (const word of targetWords) {
                for (const token of tokenizeSpeechText(word)) {
                    vocabulary.add(token);
                }
            }

            this.engine.setVocabulary([...vocabulary]);
        }
    }

    private handleTranscript(utteranceKey: string, transcript: string, isFinal: boolean): void {
        let words: string[] = transcript.split(/\s+/).filter((word) => word !== "");
        this.lastUtterance = isFinal ? undefined : { key: utteranceKey, wordCount: words.length };

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

        const oldPosition: number = this.processor.position;
        const result: IProcessResult = this.processor.process(utteranceKey, words.join(" "), isFinal);
        if (result.position !== oldPosition) {
            this.callbacks.onPositionChanged(result.position);
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
