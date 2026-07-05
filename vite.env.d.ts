// vite-env.d.ts
declare const __BUILD_VERSION__: string;

// Vite's `?worker` import returns a constructor for the bundled worker (see WhisperWebEngine).
declare module "*?worker" {
    const workerConstructor: { new (): Worker };
    export default workerConstructor;
}
