// vite-env.d.ts
declare const __BUILD_VERSION__: string;

// Vite's `?worker` import returns a constructor for the bundled worker (see WhisperWebEngine).
declare module "*?worker" {
    const workerConstructor: { new (): Worker };
    export default workerConstructor;
}

// Vite's `?url` import is the URL the asset is served from.
declare module "*?url" {
    const url: string;
    export default url;
}

// pdf.js, loaded on demand by the moderator page's packet loader (src/demo/packetFile.ts). Its own type
// declarations use syntax this TypeScript can't parse, so only the part that's used is described here.
declare module "pdfjs-dist/build/pdf.min.mjs" {
    export const GlobalWorkerOptions: { workerSrc: string };
    export const OPS: Record<string, number>;
    export function getDocument(src: unknown): { promise: Promise<unknown> };
}
