import { test, expect } from "@playwright/test";
import { openNewGameDialog, SAMPLE_PACKET_PATH } from "./game.fixture";

test.describe("packet loading via file input injection", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        // Open the New Game dialog, where the PacketLoader lives.
        await openNewGameDialog(page);
    });

    test("injects a JSON packet without opening the OS file picker", async ({ page }) => {
        // The hidden <input type="file"> is targeted directly.  Playwright's
        // setInputFiles() fires the change event just like a real file selection,
        // so the full FileReader → loadPacket pipeline runs as normal.
        const fileInput = page.locator('input[type="file"][accept*="application/json"]');
        await fileInput.setInputFiles(SAMPLE_PACKET_PATH);

        // The app shows a status message after a successful load.
        await expect(page.getByText('Packet "Test Packet" loaded.')).toBeVisible();
    });

    test("status message reports correct tossup and bonus counts", async ({ page }) => {
        const fileInput = page.locator('input[type="file"][accept*="application/json"]');
        await fileInput.setInputFiles(SAMPLE_PACKET_PATH);

        await expect(page.getByText('Packet "Test Packet" loaded. 2 tossup(s), 2 bonus(es).')).toBeVisible();
    });

    test("shows an error for a malformed packet", async ({ page }) => {
        // Create an in-memory file with invalid JSON to verify error handling.
        await page.locator('input[type="file"][accept*="application/json"]').setInputFiles({
            name: "bad-packet.json",
            mimeType: "application/json",
            buffer: Buffer.from('{ "notATossups": [] }'),
        });

        await expect(page.getByText(/error loading packet/i)).toBeVisible();
    });
});
