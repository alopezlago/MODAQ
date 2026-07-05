import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build for the Klaxon integration: the "moderator" page bundles ModaqControl
// (with errata) together with a native Klaxon buzz panel, and is served by the
// Klaxon server at /modaq/. Output goes straight into Klaxon's public dir so it
// ships as static assets (no build step in Klaxon's Docker image). Reuses
// MODAQ's proven React/wasm toolchain; Socket.IO comes from the Klaxon server's
// own /socket.io/socket.io.js, so no socket client dependency is added here.

// eslint-disable-next-line no-undef
const outDir = new URL("../../klaxon/public/modaq", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// The moderator page doesn't need MODAQ's optional in-browser speech engines,
// which otherwise pull ~29 MB of wasm (ONNX Runtime for Whisper) and the Vosk
// recognizer into the bundle. Alias those heavy deps to tiny stubs for this
// build only — the main MODAQ demo and tsc keep the real packages.
const stub = (relative: string): string =>
    new URL(relative, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

export default defineConfig(({ mode }) => {
    const dateString = new Date().toISOString();
    const version = dateString.substring(0, dateString.indexOf("T"));
    return {
        base: "/modaq/",
        resolve: {
            alias: {
                "vosk-browser": stub("./src/demo/stubs/vosk-browser.ts"),
                "@huggingface/transformers": stub("./src/demo/stubs/transformers.ts"),
            },
        },
        build: {
            outDir,
            emptyOutDir: true,
            assetsDir: "out",
            sourcemap: false,
            rollupOptions: {
                input: "moderator.html",
                output: {
                    manualChunks(id: string): string | void {
                        if (id.includes("react") || id.includes("mobx") || id === "he") {
                            return "vendor";
                        }
                        return;
                    },
                },
            },
        },
        plugins: [react()],
        define: {
            __BUILD_VERSION__: JSON.stringify(`${mode.startsWith("production") ? "" : "dev_"}${version}`),
        },
    };
});
