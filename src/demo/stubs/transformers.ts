// Build-time stub used ONLY by the Klaxon moderator bundle (see
// vite.moderator.config.ts). The real @huggingface/transformers pulls in
// ONNX Runtime Web (~23 MB of wasm) for the in-browser Whisper worker, which
// the moderator page doesn't need. Aliasing it here keeps that wasm out of the
// bundle; if a moderator enables Whisper mic tracking, pipeline() fails cleanly.
export const env: { allowLocalModels?: boolean; [key: string]: unknown } = {};

export function pipeline(..._args: unknown[]): Promise<never> {
    return Promise.reject(new Error("Speech recognition is disabled in the Klaxon moderator build."));
}
