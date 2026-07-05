// Build-time stub used ONLY by the Klaxon moderator bundle (see
// vite.moderator.config.ts). The real vosk-browser package ships a ~5 MB
// recognizer + downloads a ~40 MB model; the moderator page doesn't need
// in-browser speech, so we alias it away to keep the bundle small. If a
// moderator somehow enables Vosk mic tracking, model creation fails cleanly.
export function createModel(_modelUrl: string): Promise<never> {
    return Promise.reject(new Error("Speech recognition is disabled in the Klaxon moderator build."));
}
