/**
 * A source of speech transcripts from the microphone. Implementations wrap a specific recognition technology
 * (the native Web Speech API, or a WASM recognizer for browsers without one).
 *
 * An engine keeps listening across tossups; only its vocabulary hint changes. Restarting recognition for every
 * tossup loses the first words read, since recognizers take a moment to start.
 */
export interface ISpeechEngine {
    /** Human-readable name shown in the debug window */
    readonly name: string;

    start(): void;

    stop(): void;

    /**
     * Hints the words the speaker is likely to say (the current tossup), so engines that support it can bias
     * recognition toward them. Optional to honor; engines that can't bias just ignore it.
     */
    setVocabulary(words: string[]): void;
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

    /** Optional: called when the engine couldn't capture audio from the microphone; it will retry. */
    onAudioCaptureError?(): void;
}
