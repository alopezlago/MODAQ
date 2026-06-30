/**
 * A source of speech transcripts from the microphone. Implementations wrap a specific recognition technology
 * (the native Web Speech API, or a WASM recognizer for browsers without one).
 */
export interface ISpeechEngine {
    /** Human-readable name shown in the debug window */
    readonly name: string;

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
