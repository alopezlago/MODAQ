import path from "path";
import { test as base, Page } from "@playwright/test";

export const SAMPLE_PACKET_PATH = path.join(__dirname, "fixtures", "sample-packet.json");

// Team and player names used across all game-flow tests so assertions stay consistent.
export const TEAM_ALPHA = "Team Alpha";
export const TEAM_BETA = "Team Beta";
export const PLAYER_ALICE = "Alice";
export const PLAYER_BOB = "Bob";

type GameFixtures = {
    /** A page that has a fully started game with two teams and the sample packet loaded. */
    startedGamePage: Page;
};

export const test = base.extend<GameFixtures>({
    startedGamePage: async ({ page }, use) => {
        await startGame(page);
        await use(page);
    },
});

export { expect } from "@playwright/test";

/**
 * Opens the New Game dialog from the command bar.
 * If the app asks to export an updated game first, choose "No" so tests can proceed.
 */
export async function openNewGameDialog(page: Page): Promise<void> {
    const newGameHeading = page.getByRole("heading", { name: "New Game" });
    const dialogAlreadyOpen = await newGameHeading.isVisible({ timeout: 1000 }).catch(() => false);
    if (!dialogAlreadyOpen) {
        const newGameMenuItem = page.getByRole("menuitem", { name: "New game" }).first();

        // App startup can be delayed by network/script loading, so wait explicitly
        // for the command bar action before trying to click it.
        await newGameMenuItem.waitFor({ state: "visible", timeout: 60_000 });
        await newGameMenuItem.click();
    }

    const exportGameHeading = page.getByRole("heading", { name: "Export Game?" });
    const exportPromptVisible = await exportGameHeading.isVisible({ timeout: 1000 }).catch(() => false);

    if (exportPromptVisible) {
        await page.getByRole("button", { name: "No", exact: true }).click();
    }

    await newGameHeading.waitFor({ state: "visible", timeout: 30_000 });
}

/**
 * Opens the New Game dialog, fills in two teams with one player each, loads the
 * sample packet via setInputFiles() (no OS dialog required), and clicks Start.
 */
export async function startGame(page: Page): Promise<void> {
    await page.goto("/");
    await openNewGameDialog(page);

    // Fill in the first team name (label: "First team") and its player name.
    await page.getByLabel("First team").fill(TEAM_ALPHA);
    await page.getByLabel("Name").nth(0).fill(PLAYER_ALICE);

    // Fill in the second team name (label: "Second team") and its player name.
    // The dialog starts with 4 player rows per team, so the first second-team name is index 4.
    await page.getByLabel("Second team").fill(TEAM_BETA);
    await page.getByLabel("Name").nth(4).fill(PLAYER_BOB);

    // Load the packet via the hidden <input type="file"> — no OS file picker needed.
    await page.locator('input[type="file"][accept*="application/json"]').setInputFiles(SAMPLE_PACKET_PATH);

    // Wait for the packet-loaded status message to appear before clicking Start.
    await page.getByText('Packet "Test Packet" loaded.').waitFor({ state: "visible" });

    // Start the game.
    await page.getByRole("button", { name: "Start" }).click();

    // Confirm the game is active by waiting for the scoreboard.
    await page.getByText(TEAM_ALPHA).waitFor({ state: "visible" });
}
