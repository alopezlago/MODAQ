// Speech engine that transcribes the microphone with OpenAI's Whisper model running entirely in the browser
// (transformers.js in a Web Worker; see whisperWebWorker.ts). Nothing is sent to a server and no API key is
// needed. Whisper isn't a streaming recognizer, so -- like a hosted Whisper would -- this records the tossup's
// audio and periodically re-transcribes the audio-so-far, feeding the growing transcript into the same
// alignment pipeline as the other engines.

import { ISpeechEngine, ISpeechEngineCallbacks } from "./SpeechEngine";
// Vite compiles this as a Web Worker and gives us a constructor; the worker imports transformers.js (see the
// worker file), keeping that heavy dependency out of the main bundle until Whisper is actually used.
import WhisperWebWorker from "./whisperWebWorker?worker";

// Whisper wants 16 kHz mono audio; ask the AudioContext for that sample rate so the browser resamples for us.
const targetSampleRate = 16000;

// A quantized English base model: a good accuracy/speed balance that runs acceptably on WebGPU (and on WASM,
// more slowly). The browser caches the ~40-80 MB download after the first use.
const defaultModel = "Xenova/whisper-base.en";

// How often to re-transcribe the accumulated audio. Whisper re-runs on the whole clip, so this trades latency
// against cost; a few seconds keeps the position reasonably fresh without hammering the model.
const transcriptionIntervalInMs = 3000;

// All audio for one tossup is one growing utterance; the transcript processor de-duplicates words across calls.
const utteranceKey = "whisper-web-stream";

interface IProgressReport {
    status: string;
    file?: string;
    progress?: number;
}

type WorkerMessage =
    | { type: "ready" }
    | { type: "progress"; report: IProgressReport }
    | { type: "result"; id: number; text: string }
    | { type: "error"; id?: number; message: string };

export class WhisperWebEngine implements ISpeechEngine {
    public readonly name: string = "In-browser Whisper (base.en)";

    // Whisper re-transcribes the complete audio each time, so its partials are stable, not speculative lookahead.
    public readonly hasSpeculativePartials: boolean = false;

    private readonly callbacks: ISpeechEngineCallbacks;

    private readonly model: string;

    private active: boolean;

    private worker: Worker | undefined;

    private modelReady: boolean;

    private mediaStream: MediaStream | undefined;

    private audioContext: AudioContext | undefined;

    private processorNode: ScriptProcessorNode | undefined;

    private recordedSamples: Float32Array[];

    private recordedLength: number;

    private lastTranscribedLength: number;

    private intervalId: number | undefined;

    private requestInFlight: boolean;

    private requestId: number;

    constructor(callbacks: ISpeechEngineCallbacks, model?: string) {
        this.callbacks = callbacks;
        this.model = model ?? defaultModel;
        this.active = false;
        this.worker = undefined;
        this.modelReady = false;
        this.mediaStream = undefined;
        this.audioContext = undefined;
        this.processorNode = undefined;
        this.recordedSamples = [];
        this.recordedLength = 0;
        this.lastTranscribedLength = 0;
        this.intervalId = undefined;
        this.requestInFlight = false;
        this.requestId = 0;
    }

    public static isSupported(): boolean {
        return (
            typeof window !== "undefined" &&
            typeof Worker !== "undefined" &&
            typeof AudioContext !== "undefined" &&
            navigator.mediaDevices?.getUserMedia != undefined
        );
    }

    public start(): void {
        this.active = true;
        void this.initialize();
    }

    public stop(): void {
        this.active = false;

        if (this.intervalId != undefined) {
            window.clearInterval(this.intervalId);
            this.intervalId = undefined;
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

        if (this.worker != undefined) {
            this.worker.onmessage = null;
            this.worker.terminate();
            this.worker = undefined;
        }

        this.modelReady = false;
        this.recordedSamples = [];
        this.recordedLength = 0;
        this.lastTranscribedLength = 0;
        this.requestInFlight = false;
    }

    private async initialize(): Promise<void> {
        try {
            this.startWorker();

            this.callbacks.onStatusChanged("Requesting microphone access...");
            const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
            });

            if (!this.active) {
                mediaStream.getTracks().forEach((track) => track.stop());
                return;
            }

            this.mediaStream = mediaStream;
            this.audioContext = new AudioContext({ sampleRate: targetSampleRate });

            const source: MediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(mediaStream);
            const processorNode: ScriptProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
            processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
                if (!this.active) {
                    return;
                }

                // The context runs at 16 kHz, so these samples are already at Whisper's expected rate
                const channel: Float32Array = event.inputBuffer.getChannelData(0);
                this.recordedSamples.push(new Float32Array(channel));
                this.recordedLength += channel.length;
            };

            source.connect(processorNode);
            processorNode.connect(this.audioContext.destination);
            this.processorNode = processorNode;

            this.intervalId = window.setInterval(() => this.transcribeAccumulatedAudio(), transcriptionIntervalInMs);
        } catch (e) {
            this.stop();

            const error: Error = e instanceof Error ? e : new Error(String(e));
            if (error.name === "NotAllowedError" || error.name === "NotFoundError") {
                this.callbacks.onPermanentError(
                    "Couldn't access the microphone. Allow microphone access in your browser to track the reading position."
                );
            } else {
                this.callbacks.onPermanentError(`Couldn't start in-browser Whisper. Error: ${error.message}`);
            }
        }
    }

    private startWorker(): void {
        const device: "webgpu" | "wasm" =
            typeof navigator !== "undefined" && (navigator as Navigator & { gpu?: unknown }).gpu != undefined
                ? "webgpu"
                : "wasm";

        this.callbacks.onStatusChanged(`Loading Whisper model (${device}, downloads on first use)...`);

        const worker: Worker = new WhisperWebWorker();
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => this.handleWorkerMessage(event.data);
        worker.postMessage({ type: "load", model: this.model, device, dtype: "q8" });
        this.worker = worker;
    }

    private handleWorkerMessage(message: WorkerMessage): void {
        if (!this.active) {
            return;
        }

        switch (message.type) {
            case "ready":
                this.modelReady = true;
                this.callbacks.onStatusChanged(`Listening (in-browser Whisper, ${this.model})`);
                break;
            case "progress":
                if (message.report.status === "progress" && message.report.progress != undefined) {
                    this.callbacks.onStatusChanged(
                        `Loading Whisper model: ${Math.round(message.report.progress)}%`
                    );
                }
                break;
            case "result":
                this.requestInFlight = false;
                if (message.text.trim() !== "") {
                    this.callbacks.onPartialTranscript(utteranceKey, message.text);
                }
                this.callbacks.onStatusChanged(`Listening (in-browser Whisper, ${this.model})`);
                break;
            case "error":
                this.requestInFlight = false;
                // Transient transcription errors shouldn't kill tracking; report and keep going
                this.callbacks.onStatusChanged(`Whisper error: ${message.message}`);
                break;
        }
    }

    private transcribeAccumulatedAudio(): void {
        if (
            !this.active ||
            !this.modelReady ||
            this.requestInFlight ||
            this.worker == undefined ||
            this.recordedLength === 0 ||
            this.recordedLength <= this.lastTranscribedLength
        ) {
            return;
        }

        // Flatten every chunk recorded so far into one clip and send a copy to the worker
        const audio: Float32Array = new Float32Array(this.recordedLength);
        let offset = 0;
        for (const chunk of this.recordedSamples) {
            audio.set(chunk, offset);
            offset += chunk.length;
        }

        this.lastTranscribedLength = this.recordedLength;
        this.requestInFlight = true;
        this.requestId++;
        this.worker.postMessage({ type: "transcribe", id: this.requestId, audio }, [audio.buffer]);
    }
}
