import type { KaldiRecognizer, Model } from "vosk-browser";

import { keepAudioContextRunning } from "./AudioContextUtils";
import { ISpeechEngine, ISpeechEngineCallbacks } from "./SpeechEngine";

// vosk-browser doesn't re-export its message types, so declare the fields we read
interface IVoskPartialResultMessage {
    result: {
        partial: string;
    };
}

interface IVoskResultMessage {
    result: {
        text: string;
    };
}

// Samples per chunk sent to the recognizer. Smaller chunks reach it sooner (2048 samples is ~43 ms at 48 kHz),
// which lowers latency; they cost a few more messages to the recognizer worker.
const audioBufferSize = 2048;

// A small (~40 MB) English model hosted by the vosk-browser project. The browser caches the download.
const defaultModelUrl = "https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz";

// Loading the model is expensive (large download plus WASM initialization), so share one instance across
// engine instances (a new engine is created for each tossup)
let cachedModelPromise: Promise<Model> | undefined;
let cachedModelUrl: string | undefined;

function getModel(modelUrl: string): Promise<Model> {
    if (cachedModelPromise == undefined || cachedModelUrl !== modelUrl) {
        cachedModelUrl = modelUrl;
        cachedModelPromise = import("vosk-browser").then((vosk) => vosk.createModel(modelUrl));

        // If loading fails, clear the cache so the next attempt can retry
        cachedModelPromise.catch(() => {
            if (cachedModelUrl === modelUrl) {
                cachedModelPromise = undefined;
                cachedModelUrl = undefined;
            }
        });
    }

    return cachedModelPromise;
}

/**
 * Speech engine backed by Vosk (Kaldi compiled to WebAssembly), for browsers without the Web Speech API, like
 * Firefox. Recognition runs locally; the first use downloads an English model (~40 MB), which the browser
 * caches.
 */
export class VoskSpeechEngine implements ISpeechEngine {
    public readonly name: string = "Vosk (WebAssembly)";

    private readonly callbacks: ISpeechEngineCallbacks;

    private readonly modelUrl: string;

    private active: boolean;

    private mediaStream: MediaStream | undefined;

    private audioContext: AudioContext | undefined;

    private stopResumingAudioContext: (() => void) | undefined;

    private processorNode: ScriptProcessorNode | undefined;

    private model: Model | undefined;

    private recognizer: KaldiRecognizer | undefined;

    private utteranceCount: number;

    private vocabulary: string[];

    constructor(callbacks: ISpeechEngineCallbacks, modelUrl?: string) {
        this.callbacks = callbacks;
        this.modelUrl = modelUrl ?? defaultModelUrl;
        this.active = false;
        this.mediaStream = undefined;
        this.audioContext = undefined;
        this.stopResumingAudioContext = undefined;
        this.processorNode = undefined;
        this.model = undefined;
        this.recognizer = undefined;
        this.utteranceCount = 0;
        this.vocabulary = [];
    }

    public static isSupported(): boolean {
        return (
            typeof window !== "undefined" &&
            typeof WebAssembly !== "undefined" &&
            navigator.mediaDevices?.getUserMedia != undefined
        );
    }

    public start(): void {
        this.active = true;
        void this.initialize();
    }

    public stop(): void {
        this.active = false;
        this.cleanUp();
    }

    public setVocabulary(words: string[]): void {
        this.vocabulary = words;

        // The vocabulary is fixed when a recognizer is created, so replace the running one
        if (this.recognizer != undefined) {
            this.createRecognizer();
        }
    }

    private async initialize(): Promise<void> {
        try {
            this.callbacks.onStatusChanged("Loading speech model (~40 MB download on first use)...");
            const model: Model = await getModel(this.modelUrl);
            if (!this.active) {
                return;
            }

            this.callbacks.onStatusChanged("Requesting microphone access...");
            const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    channelCount: 1,
                },
            });

            if (!this.active) {
                mediaStream.getTracks().forEach((track) => track.stop());
                return;
            }

            this.mediaStream = mediaStream;
            this.audioContext = new AudioContext();
            this.stopResumingAudioContext = keepAudioContextRunning(this.audioContext);

            this.model = model;
            this.createRecognizer();

            const source: MediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(mediaStream);

            // ScriptProcessorNode is deprecated but still the simplest way to stream samples that works in every
            // browser; AudioWorklet requires serving a separate module file
            const processorNode: ScriptProcessorNode = this.audioContext.createScriptProcessor(audioBufferSize, 1, 1);
            processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
                if (this.active && this.recognizer != undefined) {
                    try {
                        this.recognizer.acceptWaveform(event.inputBuffer);
                    } catch (e) {
                        // Don't let one bad buffer stop the stream
                    }
                }
            };

            source.connect(processorNode);
            processorNode.connect(this.audioContext.destination);
            this.processorNode = processorNode;

            this.callbacks.onStatusChanged("Listening");
        } catch (e) {
            this.cleanUp();

            const error: Error = e instanceof Error ? e : new Error(String(e));
            if (error.name === "NotAllowedError" || error.name === "NotFoundError") {
                this.callbacks.onPermanentError(
                    "Couldn't access the microphone. Allow microphone access in your browser to track the reading position."
                );
            } else {
                this.callbacks.onPermanentError(`Couldn't start local speech recognition. Error: ${error.message}`);
            }
        }
    }

    // Creates a recognizer (replacing any current one) that only recognizes the vocabulary, if one was given. The
    // small Vosk models support a runtime grammar; restricting it to the words of the tossup (plus "[unk]" for
    // anything else) makes recognition of what's read far more accurate than open dictation.
    private createRecognizer(): void {
        if (this.model == undefined || this.audioContext == undefined) {
            return;
        }

        this.removeRecognizer();

        // Every utterance of the old recognizer is over
        this.utteranceCount++;

        const grammar: string | undefined =
            this.vocabulary.length > 0 ? JSON.stringify([...this.vocabulary, "[unk]"]) : undefined;
        const recognizer: KaldiRecognizer = new this.model.KaldiRecognizer(this.audioContext.sampleRate, grammar);
        recognizer.on("partialresult", (message) => {
            const partial: string = ((message as unknown) as IVoskPartialResultMessage).result.partial;
            if (partial !== "" && this.recognizer === recognizer) {
                this.callbacks.onPartialTranscript(`vosk-${this.utteranceCount}`, partial);
            }
        });
        recognizer.on("result", (message) => {
            if (this.recognizer !== recognizer) {
                return;
            }

            const text: string = ((message as unknown) as IVoskResultMessage).result.text;
            if (text !== "") {
                this.callbacks.onFinalTranscript(`vosk-${this.utteranceCount}`, text);
            }

            this.utteranceCount++;
        });
        this.recognizer = recognizer;
    }

    private removeRecognizer(): void {
        if (this.recognizer != undefined) {
            try {
                this.recognizer.remove();
            } catch (e) {
                // The worker could already be gone
            }

            this.recognizer = undefined;
        }
    }

    private cleanUp(): void {
        this.removeRecognizer();

        if (this.processorNode != undefined) {
            this.processorNode.onaudioprocess = null;
            this.processorNode.disconnect();
            this.processorNode = undefined;
        }

        this.stopResumingAudioContext?.();
        this.stopResumingAudioContext = undefined;

        if (this.audioContext != undefined) {
            void this.audioContext.close().catch(() => undefined);
            this.audioContext = undefined;
        }

        if (this.mediaStream != undefined) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = undefined;
        }

        // Keep the cached model; it's expensive to load and other tossups will reuse it
    }
}
