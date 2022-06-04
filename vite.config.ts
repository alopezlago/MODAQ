import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/

export default defineConfig(({ mode }) => {
    const dateString = new Date().toISOString();
    const version = dateString.substring(0, dateString.indexOf("T"));
    return {
        build: {
            assetsDir: "out",
            sourcemap: true,
        },
        plugins: [react(), splitVendorChunkPlugin()],
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
