import { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import path from "path";
import { openNewGameDialog, SAMPLE_PACKET_PATH } from "./game.fixture";

const INDIVIDUAL_GAME_QBJ = path.join(__dirname, "fixtures", "individual-game.qbj");
const INDIVIDUAL_ROSTER_QBJ = path.join(__dirname, "fixtures", "individual-roster.qbj");

/** Opens the "New game" split button's submenu, where the import entries live. */
async function openNewGameSubmenu(page: Page): Promise<void> {
    await page.getByRole("menuitem", { name: "New game", exact: true }).first().waitFor({ timeout: 60_000 });
    await page.locator(".ms-OverflowSet-item").first().locator("button").nth(1).click();
}

const PLAYERS: string[] = [
    "Alice",
    "Bob",
    "Carol",
    "Dave",
    "Erin",
    "Frank",
    "Grace",
    "Heidi",
    "Ivan",
    "Judy",
    "Ken",
    "Leo",
    "Mallory",
    "Niaj",
    "Olivia",
    "Peggy",
];

/** Picks the IPNCT format in the New Game dialog's format dropdown. */
async function selectIndividualFormat(page: Page): Promise<void> {
    await page.getByRole("combobox", { name: "Format" }).click();
    await page.getByRole("option", { name: "IPNCT (individual)" }).click();
}

/**
 * Starts an individual game with the given player names and the sample packet.
 */
async function startIndividualGame(page: Page, playerNames: string[]): Promise<void> {
    await page.goto("/");
    await openNewGameDialog(page);
    await selectIndividualFormat(page);

    // The roster starts with eight blank entries; add rows for anyone past that
    for (let i = 8; i < playerNames.length; i++) {
        await page.getByRole("button", { name: "Add player" }).click();
    }

    for (let i = 0; i < playerNames.length; i++) {
        await page.getByRole("textbox", { name: `Player ${i + 1}`, exact: true }).fill(playerNames[i]);
    }

    await page.locator('input[type="file"][accept*="application/json"]').setInputFiles(SAMPLE_PACKET_PATH);
    await page.getByText('Packet "Test Packet" loaded.').waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Start" }).click();
    await page.getByRole("heading", { name: "New Game" }).waitFor({ state: "hidden" });
}

/** Marks a buzz on the given word of the current tossup as correct or wrong. */
async function markBuzz(page: Page, wordIndex: number, playerName: string, isCorrect: boolean): Promise<void> {
    await page.locator(`span[data-index="${wordIndex}"]`).first().click();
    await page.getByRole("menuitem", { name: new RegExp(`(^|\\. )${playerName}$`) }).click();
    await page.getByRole("menuitemcheckbox", { name: isCorrect ? /Correct/ : /Wrong/ }).click();
}

test.describe("individual (IPNCT) format", () => {
    test("the format is offered and describes its rules", async ({ page }) => {
        await page.goto("/");
        await openNewGameDialog(page);
        await selectIndividualFormat(page);

        await expect(page.getByText("Individual play: up to 16 players")).toBeVisible();
        await expect(page.getByText("Every wrong buzz negs")).toBeVisible();
        await expect(page.getByText("Tossups only (no bonuses)")).toBeVisible();
    });

    test("picking it swaps the team rosters for a single player list", async ({ page }) => {
        await page.goto("/");
        await openNewGameDialog(page);

        await expect(page.getByLabel("First team")).toBeVisible();

        await selectIndividualFormat(page);

        await expect(page.getByLabel("First team")).not.toBeVisible();
        await expect(page.getByLabel("Second team")).not.toBeVisible();
        await expect(page.getByRole("textbox", { name: "Player 1", exact: true })).toBeVisible();
    });

    test("the roster stops at sixteen players", async ({ page }) => {
        await page.goto("/");
        await openNewGameDialog(page);
        await selectIndividualFormat(page);

        const addPlayerButton = page.getByRole("button", { name: "Add player" });
        for (let i = 8; i < 16; i++) {
            await addPlayerButton.click();
        }

        await expect(page.getByRole("textbox", { name: "Player 16", exact: true })).toBeVisible();

        // The button is disabled at the cap, and no seventeenth row appears
        await expect(page.getByRole("button", { name: /A game can only have 16 players/ })).toBeDisabled();
        await expect(page.getByRole("textbox", { name: "Player 17", exact: true })).toHaveCount(0);
    });

    test("a game with sixteen players starts and scores each one separately", async ({ page }) => {
        await startIndividualGame(page, PLAYERS);

        // Every competitor is on the scoreboard at 0
        for (const playerName of PLAYERS) {
            await expect(page.getByText(new RegExp(`${playerName}: 0`)).first()).toBeVisible();
        }
    });

    test("more than one player can neg the same tossup", async ({ page }) => {
        await startIndividualGame(page, ["Alice", "Bob", "Carol"]);

        await markBuzz(page, 1, "Alice", /* isCorrect */ false);
        await markBuzz(page, 2, "Bob", /* isCorrect */ false);
        await markBuzz(page, 3, "Carol", /* isCorrect */ true);

        // Both early buzzes are negs, unlike a team format where only the first would be
        await expect(page.getByText(/Alice: -5/)).toBeVisible();
        await expect(page.getByText(/Bob: -5/)).toBeVisible();
        await expect(page.getByText(/Carol: 1[05]/)).toBeVisible();
    });

    test("a QBJ game with more than two competitors imports", async ({ page }) => {
        await page.goto("/");
        await openNewGameSubmenu(page);
        await page.getByRole("menuitem", { name: "Import from QBJ..." }).click();
        await page.getByRole("heading", { name: "Import from QBJ" }).waitFor({ state: "visible", timeout: 30_000 });

        // Pick the format first: the team count is validated against it
        await page.getByRole("tab", { name: "Format" }).click();
        await selectIndividualFormat(page);

        await page.getByRole("tab", { name: "Packet" }).click();
        await page.locator('input[type="file"]').last().setInputFiles(SAMPLE_PACKET_PATH);
        await expect(page.getByText(/Packet .* loaded\./)).toBeVisible({ timeout: 30_000 });

        await page.getByRole("tab", { name: "QBJ", exact: true }).click();
        await page.locator('input[type="file"]').first().setInputFiles(INDIVIDUAL_GAME_QBJ);

        await page.getByRole("button", { name: "OK" }).click();
        await page.getByRole("heading", { name: "Import from QBJ" }).waitFor({ state: "hidden", timeout: 30_000 });

        // Four competitors, and both of the early buzzes kept their neg through the round trip
        const scoreboard = page.locator("label").filter({ hasText: /Alice/ }).first();
        await expect(scoreboard).toBeVisible({ timeout: 30_000 });
        const text = (await scoreboard.textContent()) ?? "";
        expect(text).toContain("Alice: -5");
        expect(text).toContain("Bob: -5");
        expect(text).toContain("Carol: 10");
        expect(text).toContain("Dave: 0");
    });

    test("a team format rejects a QBJ game with more than two teams", async ({ page }) => {
        await page.goto("/");
        await openNewGameSubmenu(page);
        await page.getByRole("menuitem", { name: "Import from QBJ..." }).click();
        await page.getByRole("heading", { name: "Import from QBJ" }).waitFor({ state: "visible", timeout: 30_000 });

        await page.getByRole("tab", { name: "Packet" }).click();
        await page.locator('input[type="file"]').last().setInputFiles(SAMPLE_PACKET_PATH);
        await expect(page.getByText(/Packet .* loaded\./)).toBeVisible({ timeout: 30_000 });

        await page.getByRole("tab", { name: "QBJ", exact: true }).click();
        await page.locator('input[type="file"]').first().setInputFiles(INDIVIDUAL_GAME_QBJ);
        await page.getByRole("button", { name: "OK" }).click();

        // The message should point at the fix rather than just refusing
        await expect(page.getByText(/Pick an individual format/)).toBeVisible({ timeout: 30_000 });
    });

    test("a roster file supplies the field for an individual game", async ({ page }) => {
        await page.goto("/");
        await openNewGameDialog(page);
        await selectIndividualFormat(page);

        await page.getByRole("tab", { name: "From QBJ Registration" }).click();
        await page.locator('input[type="file"]').first().setInputFiles(INDIVIDUAL_ROSTER_QBJ);

        await expect(page.getByText("Players (0 of up to 16)")).toBeVisible({ timeout: 30_000 });

        // Fluent paints the checkmark over the input, so the click has to be forced
        for (const name of ["Alice", "Bob", "Carol"]) {
            await page.getByRole("checkbox", { name, exact: true }).check({ force: true });
        }
        await expect(page.getByText("Players (3 of up to 16)")).toBeVisible();

        await page.locator('input[type="file"][accept*="application/json"]').last().setInputFiles(SAMPLE_PACKET_PATH);
        await expect(page.getByText('Packet "Test Packet" loaded.')).toBeVisible({ timeout: 30_000 });

        await page.getByRole("button", { name: "Start" }).click();
        await page.getByRole("heading", { name: "New Game" }).waitFor({ state: "hidden", timeout: 30_000 });

        // Each competitor plays for themselves, so they each land on the scoreboard
        for (const name of ["Alice", "Bob", "Carol"]) {
            await expect(page.getByText(new RegExp(`${name}: 0`)).first()).toBeVisible({ timeout: 30_000 });
        }
    });

    test("no bonus is shown after a correct buzz", async ({ page }) => {
        await startIndividualGame(page, ["Alice", "Bob"]);

        await markBuzz(page, 3, "Alice", /* isCorrect */ true);

        await expect(page.getByText("No more bonuses available.")).toHaveCount(0);
        await expect(page.getByText(/Bonus \d/)).toHaveCount(0);
    });
});
