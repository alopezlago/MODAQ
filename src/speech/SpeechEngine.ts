/**
 * A source of speech transcripts from the microphone. Implementations wrap a specific recognition technology
 * (the native Web Speech API, or a WASM recognizer for browsers without one).
 */
export interface ISpeechEngine {
    /** Human-readable name shown in the debug window */
    readonly name: string;

    /**
     * Whether this engine's partial (non-final) transcripts are speculative guesses it revises as it hears more,
     * versus stable transcriptions of the audio so far. The Web Speech API and Vosk emit speculative interims
     * that can run ahead and then get walked back; the Whisper engine re-transcribes complete audio, so its
     * partials are stable. The reader-follow modes that guard against interim overshoot only apply to engines
     * with speculative partials.
     */
    readonly hasSpeculativePartials: boolean;

    start(): void;

    stop(): void;
}

export interface ISpeechEngineCallbacks {
    /**
     * Called with the latest (possibly growing or revised) transcript of the utterance identified by
     * `utteranceKey`.
     */
    onPartialTranscript(utteranceKey: string, transcript: string): void;

    /** Called with the complete transcript when the utterance identified by `utteranceKey` ends. */
    onFinalTranscript(utteranceKey: string, transcript: string): void;

    /** Called when the engine's state changes; purely informational (shown in the debug window). */
    onStatusChanged(status: string): void;

    /** Called when the engine can't keep running (e.g. microphone access was denied). */
    onPermanentError(message: string): void;
}
