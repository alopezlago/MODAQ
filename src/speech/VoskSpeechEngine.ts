import type { KaldiRecognizer, Model } from "vosk-browser";

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

    private processorNode: ScriptProcessorNode | undefined;

    private recognizer: KaldiRecognizer | undefined;

    private utteranceCount: number;

    constructor(callbacks: ISpeechEngineCallbacks, modelUrl?: string) {
        this.callbacks = callbacks;
        this.modelUrl = modelUrl ?? defaultModelUrl;
        this.active = false;
        this.mediaStream = undefined;
        this.audioContext = undefined;
        this.processorNode = undefined;
        this.recognizer = undefined;
        this.utteranceCount = 0;
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

            const recognizer: KaldiRecognizer = new model.KaldiRecognizer(this.audioContext.sampleRate);
            recognizer.on("partialresult", (message) => {
                const partial: string = (message as unknown as IVoskPartialResultMessage).result.partial;
                if (partial !== "") {
                    this.callbacks.onPartialTranscript(`vosk-${this.utteranceCount}`, partial);
                }
            });
            recognizer.on("result", (message) => {
                const text: string = (message as unknown as IVoskResultMessage).result.text;
                if (text !== "") {
                    this.callbacks.onFinalTranscript(`vosk-${this.utteranceCount}`, text);
                }

                this.utteranceCount++;
            });
            this.recognizer = recognizer;

            const source: MediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(mediaStream);

            // ScriptProcessorNode is deprecated but still the simplest way to stream samples that works in every
            // browser; AudioWorklet requires serving a separate module file
            const processorNode: ScriptProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
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

    private cleanUp(): void {
        if (this.recognizer != undefined) {
            try {
                this.recognizer.remove();
            } catch (e) {
                // The worker could already be gone
            }

            this.recognizer = undefined;
        }

        if (this.processorNode != undefined) {
            this.processorNode.onaudioprocess = null;
            this.processorNode.disconnect();
            this.processorNode = undefined;
        }

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
