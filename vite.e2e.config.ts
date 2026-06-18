import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for E2E tests: plain HTTP (no mkcert) on a fixed port so
// playwright.config.ts can depend on it without certificate issues.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,
        strictPort: true,
        watch: {
            ignored: ["**/playwright-report/**", "**/test-results/**"],
        },
    },
    define: {
        // Required by src/demo/app.tsx
        __BUILD_VERSION__: JSON.stringify("e2e-test"),
    },
});
