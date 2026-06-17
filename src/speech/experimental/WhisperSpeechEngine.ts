// EXPERIMENTAL — see README.md in this folder. Speech engine that transcribes the microphone with OpenAI's
// Whisper model (hosted API). Unlike the Web Speech API and Vosk, Whisper isn't a streaming recognizer: it
// transcribes complete audio. So this records the tossup's audio continuously and periodically re-sends the
// audio-so-far for transcription, feeding the growing transcript into the same alignment pipeline.
//
// This whole folder can be deleted to remove the feature; the only other change is the guarded branch in
// ../ReaderFollower.ts that calls tryCreateExperimentalWhisperEngine.

import { ISpeechEngine, ISpeechEngineCallbacks } from "../SpeechEngine";
import { getWhisperConfig, IWhisperConfig } from "./WhisperConfig";

// MediaRecorder and BlobEvent aren't in this TypeScript version's dom library, so declare the small surface we
// use (mirrors how WebSpeechEngine declares the Speech API types)
interface IBlobEvent {
    data: Blob;
}

interface IMediaRecorder {
    state: "inactive" | "recording" | "paused";
    ondataavailable: ((event: IBlobEvent) => void) | null;
    start(timesliceInMs?: number): void;
    stop(): void;
}

interface IMediaRecorderOptions {
    mimeType?: string;
}

interface IMediaRecorderConstructor {
    new (stream: MediaStream, options?: IMediaRecorderOptions): IMediaRecorder;
    isTypeSupported(mimeType: string): boolean;
}

declare const MediaRecorder: IMediaRecorderConstructor | undefined;

// All audio for one tossup is one growing utterance; the transcript processor de-duplicates words across calls
const utteranceKey = "whisper-stream";

// MediaRecorder needs a mime type it supports and whose container OpenAI accepts. The file name extension we
// send has to match the actual format, since the API detects format from the file name.
const candidateRecordingTypes: { mimeType: string; extension: string }[] = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
    { mimeType: "audio/mp4", extension: "mp4" },
];

// Whisper's prompt biases recognition toward expected vocabulary, which helps a lot with quizbowl jargon and
// proper nouns. The prompt is limited, so only send the start of the question.
const maximumBiasWords = 180;

interface ITranscriptionResponse {
    text?: string;
    error?: { message?: string };
}

export class WhisperSpeechEngine implements ISpeechEngine {
    public readonly name: string = "OpenAI Whisper (experimental)";

    private readonly callbacks: ISpeechEngineCallbacks;

    private readonly config: IWhisperConfig;

    private readonly biasPrompt: string | undefined;

    private active: boolean;

    private mediaStream: MediaStream | undefined;

    private recorder: IMediaRecorder | undefined;

    private recordingExtension: string;

    private recordedChunks: Blob[];

    private intervalId: number | undefined;

    private requestInFlight: boolean;

    private abortController: AbortController | undefined;

    private lastTranscribedByteSize: number;

    constructor(callbacks: ISpeechEngineCallbacks, config: IWhisperConfig, biasText?: string) {
        this.callbacks = callbacks;
        this.config = config;
        this.biasPrompt = buildBiasPrompt(biasText);
        this.active = false;
        this.mediaStream = undefined;
        this.recorder = undefined;
        this.recordingExtension = "webm";
        this.recordedChunks = [];
        this.intervalId = undefined;
        this.requestInFlight = false;
        this.abortController = undefined;
        this.lastTranscribedByteSize = 0;
    }

    public static isSupported(): boolean {
        return (
            typeof window !== "undefined" &&
            MediaRecorder != undefined &&
            typeof fetch !== "undefined" &&
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

        if (this.abortController != undefined) {
            this.abortController.abort();
            this.abortController = undefined;
        }

        if (this.recorder != undefined) {
            this.recorder.ondataavailable = null;
            try {
                if (this.recorder.state !== "inactive") {
                    this.recorder.stop();
                }
            } catch (e) {
                // Already stopped; nothing to do
            }

            this.recorder = undefined;
        }

        if (this.mediaStream != undefined) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = undefined;
        }

        this.recordedChunks = [];
        this.lastTranscribedByteSize = 0;
    }

    private async initialize(): Promise<void> {
        const mediaRecorderConstructor: IMediaRecorderConstructor | undefined = MediaRecorder;
        if (mediaRecorderConstructor == undefined) {
            this.callbacks.onPermanentError("Audio recording isn't supported in this browser.");
            return;
        }

        try {
            this.callbacks.onStatusChanged("Requesting microphone access...");
            const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
            });

            if (!this.active) {
                mediaStream.getTracks().forEach((track) => track.stop());
                return;
            }

            this.mediaStream = mediaStream;

            const recordingType = candidateRecordingTypes.find((type) =>
                mediaRecorderConstructor.isTypeSupported(type.mimeType)
            );
            this.recordingExtension = recordingType?.extension ?? "webm";

            const recorder: IMediaRecorder = new mediaRecorderConstructor(
                mediaStream,
                recordingType != undefined ? { mimeType: recordingType.mimeType } : undefined
            );
            recorder.ondataavailable = (event: IBlobEvent) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            // Emit a chunk every second so the accumulated blob can be transcribed periodically. Concatenating
            // all chunks from the first one yields a valid file, since the first chunk holds the container header.
            recorder.start(1000);
            this.recorder = recorder;

            this.intervalId = window.setInterval(() => void this.transcribeAccumulatedAudio(), this.config.transcriptionIntervalInMs);
            this.callbacks.onStatusChanged(`Listening (Whisper, model ${this.config.model})`);
        } catch (e) {
            this.stop();

            const error: Error = e instanceof Error ? e : new Error(String(e));
            if (error.name === "NotAllowedError" || error.name === "NotFoundError") {
                this.callbacks.onPermanentError(
                    "Couldn't access the microphone. Allow microphone access in your browser to track the reading position."
                );
            } else {
                this.callbacks.onPermanentError(`Couldn't start Whisper recording. Error: ${error.message}`);
            }
        }
    }

    private async transcribeAccumulatedAudio(): Promise<void> {
        if (!this.active || this.requestInFlight || this.recordedChunks.length === 0) {
            return;
        }

        const audioBlob: Blob = new Blob(this.recordedChunks, { type: this.recordedChunks[0].type });
        if (audioBlob.size <= this.lastTranscribedByteSize) {
            // No new audio since the last transcription
            return;
        }

        this.lastTranscribedByteSize = audioBlob.size;
        this.requestInFlight = true;
        this.abortController = new AbortController();

        try {
            const formData: FormData = new FormData();
            formData.append("file", audioBlob, `audio.${this.recordingExtension}`);
            formData.append("model", this.config.model);
            formData.append("response_format", "json");
            formData.append("language", "en");
            formData.append("temperature", "0");
            if (this.biasPrompt != undefined) {
                formData.append("prompt", this.biasPrompt);
            }

            const response: Response = await fetch(`${this.config.baseUrl}/audio/transcriptions`, {
                method: "POST",
                headers: { Authorization: `Bearer ${this.config.apiKey}` },
                body: formData,
                signal: this.abortController.signal,
            });

            if (!this.active) {
                return;
            }

            if (response.status === 401 || response.status === 403) {
                this.stop();
                this.callbacks.onPermanentError(
                    "Whisper rejected the API key. Check the experimental Whisper settings (see the README)."
                );
                return;
            }

            const body: ITranscriptionResponse = await response.json().catch(() => ({} as ITranscriptionResponse));
            if (!response.ok) {
                // Transient errors (rate limits, server hiccups) shouldn't kill tracking; report and keep going
                this.callbacks.onStatusChanged(
                    `Whisper error ${response.status}: ${body.error?.message ?? "request failed"}`
                );
                return;
            }

            if (body.text != undefined && body.text.trim() !== "") {
                // The transcript covers all audio so far and grows over time; the processor feeds only new words
                this.callbacks.onPartialTranscript(utteranceKey, body.text);
            }

            this.callbacks.onStatusChanged(`Listening (Whisper, model ${this.config.model})`);
        } catch (e) {
            const error: Error = e instanceof Error ? e : new Error(String(e));
            if (error.name !== "AbortError" && this.active) {
                this.callbacks.onStatusChanged(`Whisper request failed: ${error.message}`);
            }
        } finally {
            this.requestInFlight = false;
            this.abortController = undefined;
        }
    }
}

function buildBiasPrompt(biasText: string | undefined): string | undefined {
    if (biasText == undefined) {
        return undefined;
    }

    const words: string[] = biasText.split(/\s+/).filter((word) => word !== "");
    if (words.length === 0) {
        return undefined;
    }

    return words.slice(0, maximumBiasWords).join(" ");
}

/**
 * Creates the experimental Whisper engine if it's been enabled (via localStorage; see README.md), otherwise
 * returns undefined so the caller falls back to the normal engines. `biasText` is the question text, used to
 * bias recognition toward the expected words.
 */
export function tryCreateExperimentalWhisperEngine(
    callbacks: ISpeechEngineCallbacks,
    biasText?: string
): WhisperSpeechEngine | undefined {
    const config: IWhisperConfig | undefined = getWhisperConfig();
    if (config == undefined || !WhisperSpeechEngine.isSupported()) {
        return undefined;
    }

    return new WhisperSpeechEngine(callbacks, config, biasText);
}
