import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/

export default defineConfig(({ mode }) => {
    const dateString = new Date().toISOString();
    const version = dateString.substring(0, dateString.indexOf("T"));
    return {
        build: {
            assetsDir: "out",
            sourcemap: true,
            rollupOptions: {
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
        server: {
            watch: {
                // Avoid watcher crashes/reloads from Playwright artifacts that may be created/deleted rapidly.
                ignored: ["**/playwright-report/**", "**/test-results/**"],
            },
        },
        plugins: [react(), mkcert()],
        define: {
            __BUILD_VERSION__: JSON.stringify(`${mode.startsWith("production") ? "" : "dev_"}${version}`),
        },
    };

    // If we ever need to separate sersve and build, follow this pattern:
    // // if (command === "serve") {
    // //     // dev specific config
    // // } else {
    // //     // command === 'build'
    // //     // build specific config
    // //     return { ...baseConfig };
    // // }
});
