// Web Worker that runs OpenAI's Whisper model entirely in the browser via transformers.js (ONNX Runtime Web,
// WebGPU with a WASM fallback). It loads the model once, then transcribes 16 kHz mono Float32 audio on request.
// Running in a worker keeps the (heavy) inference off the UI thread. Paired with WhisperWebEngine.ts.

import { pipeline, env } from "@huggingface/transformers";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

// Models are fetched from the Hugging Face hub and cached by the browser; there are no local model files.
env.allowLocalModels = false;

interface ILoadMessage {
    type: "load";
    model: string;
    device: "webgpu" | "wasm";
    dtype: string;
}

interface ITranscribeMessage {
    type: "transcribe";
    id: number;
    audio: Float32Array;
}

type InMessage = ILoadMessage | ITranscribeMessage;

interface IProgressReport {
    status: string;
    file?: string;
    progress?: number;
}

type OutMessage =
    | { type: "ready" }
    | { type: "progress"; report: IProgressReport }
    | { type: "result"; id: number; text: string }
    | { type: "error"; id?: number; message: string };

// The worker global has a single-argument postMessage; cast past the DOM Window typing to avoid a type clash.
const workerScope = self as unknown as {
    postMessage(message: OutMessage): void;
    onmessage: ((event: MessageEvent<InMessage>) => void) | null;
};

function post(message: OutMessage): void {
    workerScope.postMessage(message);
}

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | undefined;

function loadTranscriber(message: ILoadMessage): Promise<AutomaticSpeechRecognitionPipeline> {
    if (transcriberPromise == undefined) {
        transcriberPromise = pipeline("automatic-speech-recognition", message.model, {
            device: message.device,
            dtype: message.dtype as "q8",
            progress_callback: (report: IProgressReport) => post({ type: "progress", report }),
        });
    }

    return transcriberPromise;
}

workerScope.onmessage = async (event: MessageEvent<InMessage>): Promise<void> => {
    const message: InMessage = event.data;

    try {
        if (message.type === "load") {
            await loadTranscriber(message);
            post({ type: "ready" });
            return;
        }

        // transcribe
        if (transcriberPromise == undefined) {
            post({ type: "error", id: message.id, message: "The Whisper model hasn't been loaded yet." });
            return;
        }

        const transcriber: AutomaticSpeechRecognitionPipeline = await transcriberPromise;
        // Whisper handles at most 30 s at a time; chunk longer audio with a little overlap so nothing is dropped.
        // Note: this is an English-only (.en) model, so `language`/`task` must NOT be passed (it rejects them).
        const output = await transcriber(message.audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
        });

        const text: string = Array.isArray(output)
            ? output.map((piece) => piece.text).join(" ")
            : output.text;
        post({ type: "result", id: message.id, text });
    } catch (e) {
        const errorMessage: string = e instanceof Error ? e.message : String(e);
        post({ type: "error", id: message.type === "transcribe" ? message.id : undefined, message: errorMessage });
    }
};
