import { test, expect } from "@playwright/test";
import { openNewGameDialog, startGame, TEAM_ALPHA, TEAM_BETA, PLAYER_ALICE, PLAYER_BOB } from "./game.fixture";
import { SAMPLE_PACKET_PATH } from "./game.fixture";

test.describe("new game dialog", () => {
    test("dialog opens and closes", async ({ page }) => {
        await page.goto("/");
        await openNewGameDialog(page);
        await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();

        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "New Game" })).not.toBeVisible();
    });

    test("Start is disabled until a packet is loaded", async ({ page }) => {
        await page.goto("/");
        await openNewGameDialog(page);

        // The Start button should be present but the form should require a packet.
        // Fill in teams so validation only blocks on the missing packet.
        await page.getByLabel("First team").fill(TEAM_ALPHA);
        await page.getByLabel("Name").nth(0).fill(PLAYER_ALICE);
        await page.getByLabel("Second team").fill(TEAM_BETA);
        await page.getByLabel("Name").nth(4).fill(PLAYER_BOB);

        // Clicking Start without a packet should not dismiss the dialog.
        await page.getByRole("button", { name: "Start" }).click();
        await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();
    });

    test("successfully starts a game with two teams and a packet", async ({ page }) => {
        await startGame(page);

        // After starting, the dialog should be gone and the scoreboard visible.
        await expect(page.getByRole("heading", { name: "New Game" })).not.toBeVisible();
        await expect(page.getByText(TEAM_ALPHA)).toBeVisible();
        await expect(page.getByText(TEAM_BETA)).toBeVisible();
    });

    test("scoreboard starts at 0 for both teams", async ({ page }) => {
        await startGame(page);

        // The scoreboard label format is "Team Alpha: 0, Team Beta: 0" (horizontal)
        // or individual rows (vertical). Match the score labels regardless of layout.
        const scoreLabels = page.getByText(/team alpha.*0|team beta.*0/i);
        await expect(scoreLabels.first()).toBeVisible();
    });

    test("first tossup question text is visible after game starts", async ({ page }) => {
        await startGame(page);
        // The first word of tossup 1 from sample-packet.json
        await expect(page.getByText(/George/i).first()).toBeVisible();
    });

    test("can start a second game from menu without crashing", async ({ page }) => {
        await startGame(page);

        // Start another new game — because there are no exports configured, the
        // "Export Game?" prompt can appear once game updates exist; helper handles it.
        await openNewGameDialog(page);

        await page.getByLabel("First team").fill("Red Team");
        await page.getByLabel("Name").nth(0).fill("Charlie");
        await page.getByLabel("Second team").fill("Blue Team");
        await page.getByLabel("Name").nth(4).fill("Diana");
        await page.locator('input[type="file"][accept*="application/json"]').setInputFiles(SAMPLE_PACKET_PATH);
        await page.getByText('Packet "Test Packet" loaded.').waitFor({ state: "visible" });
        await page.getByRole("button", { name: "Start" }).click();

        await expect(page.getByText("Red Team")).toBeVisible();
        await expect(page.getByText("Blue Team")).toBeVisible();
    });
});
