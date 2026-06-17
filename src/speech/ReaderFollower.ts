import { ISpeechEngine, ISpeechEngineCallbacks } from "./SpeechEngine";
import {
    IncrementalTranscriptProcessor,
    IProcessResult,
    normalizeSpokenWord,
    TranscriptAligner,
} from "./TranscriptAligner";
import { VoskSpeechEngine } from "./VoskSpeechEngine";
import { WebSpeechEngine } from "./WebSpeechEngine";
import { tryCreateExperimentalWhisperEngine } from "./experimental/WhisperSpeechEngine";

// Words the moderator says right after a buzz is resolved ("correct", "neg 5", "power, 15 points"). Hearing one
// means a buzz just happened, so the buzz point should update right away instead of waiting for a pause.
// Recognizers write numbers as digits or words depending on context, so include both forms.
const buzzResolutionWords: Set<string> = new Set([
    "correct",
    "incorrect",
    "power",
    "neg",
    "15",
    "fifteen",
    "10",
    "ten",
]);

export interface IReaderFollowerCallbacks {
    /** Called when we believe the reader has read up to (and including) the given word index. */
    onPositionChanged(wordIndex: number): void;

    /** Called when listening can't continue (e.g. microphone access was denied). */
    onPermanentError(message: string): void;

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
 * read. Positions are word indexes into the target words passed to `start`, and only ever move forward.
 *
 * Uses the native Web Speech API when the browser has one (Chrome/Edge/Safari), and falls back to a local
 * WebAssembly recognizer (Vosk) in browsers without it, like Firefox.
 */
export class ReaderFollower {
    private readonly callbacks: IReaderFollowerCallbacks;

    private engine: ISpeechEngine | undefined;

    private processor: IncrementalTranscriptProcessor | undefined;

    constructor(callbacks: IReaderFollowerCallbacks) {
        this.callbacks = callbacks;
        this.engine = undefined;
        this.processor = undefined;
    }

    public static isSupported(): boolean {
        return WebSpeechEngine.isSupported() || VoskSpeechEngine.isSupported();
    }

    /**
     * Starts listening and following along the given words. Any previous session is stopped first.
     */
    public start(targetWords: string[]): void {
        this.stop();

        this.processor = new IncrementalTranscriptProcessor(new TranscriptAligner(targetWords));

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
        };

        // EXPERIMENTAL: if the OpenAI Whisper engine has been enabled (see src/speech/experimental/README.md),
        // use it. Off by default, so this returns undefined and the normal engines are used. Remove this line
        // and the import to drop the experimental feature entirely.
        const experimentalEngine: ISpeechEngine | undefined = tryCreateExperimentalWhisperEngine(
            engineCallbacks,
            targetWords.join(" ")
        );

        this.engine =
            experimentalEngine ??
            (WebSpeechEngine.isSupported() ? new WebSpeechEngine(engineCallbacks) : new VoskSpeechEngine(engineCallbacks));
        this.engine.start();
    }

    public stop(): void {
        if (this.engine != undefined) {
            const engine: ISpeechEngine = this.engine;
            this.engine = undefined;
            engine.stop();
        }

        this.processor = undefined;
    }

    private handleTranscript(utteranceKey: string, transcript: string, isFinal: boolean): void {
        if (this.processor == undefined) {
            return;
        }

        if (this.callbacks.onTranscript != undefined && transcript.trim() !== "") {
            this.callbacks.onTranscript(transcript.trim());
        }

        const oldPosition: number = this.processor.position;
        const result: IProcessResult = this.processor.process(utteranceKey, transcript, isFinal);
        if (result.position !== oldPosition && result.position >= 0) {
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
