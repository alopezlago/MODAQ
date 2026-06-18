import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    // Run tests in the same file serially — the app has global state (MobX) so
    // parallel workers within a file can interfere.
    fullyParallel: false,
    // Fail the build on CI if you accidentally left test.only in the source.
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: [["html", { open: "never" }]],
    use: {
        baseURL: "http://localhost:5174",
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        // Use the mkcert-free vite config so tests run over plain HTTP and
        // don't require a system-level mkcert installation.
        command: "yarn vite --config vite.e2e.config.ts",
        url: "http://localhost:5174",
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
