import { test, expect, Page } from "@playwright/test";
import { startGame, PLAYER_ALICE } from "./game.fixture";

// Distinctive single words from tests/e2e/fixtures/sample-packet.json. The question text is rendered one word
// per element so it can be buzzed on, so a locator has to match a word rather than a phrase.
const firstTossupText = "farewell";
const secondTossupText = "Knuth-Morris-Pratt";
const firstBonusText = "Madrid";

async function turnOnOneQuestionAtATime(page: Page): Promise<void> {
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitemcheckbox", { name: "One question at a time" }).click();
}

/** Marks the tossup correct for Alice by clicking a word and using the buzz menu. */
async function convertTossup(page: Page): Promise<void> {
    await page.locator("[data-index='3']").first().click();
    await page.getByRole("menuitem", { name: new RegExp(PLAYER_ALICE) }).click();
    await page.getByRole("menuitemcheckbox", { name: /Correct/ }).click();
}

test.describe("one question at a time", () => {
    test("the bonus is hidden until the tossup is converted", async ({ page }) => {
        await startGame(page);

        // Both halves of the question are on screen by default
        await expect(page.getByText(firstBonusText).first()).toBeVisible();

        await turnOnOneQuestionAtATime(page);

        await expect(page.getByText(firstTossupText).first()).toBeVisible();
        await expect(page.getByText(firstBonusText).first()).not.toBeVisible();
        await expect(page.getByText("Tossup #1")).toBeVisible();
    });

    test("Next reads the bonus after a correct buzz, then moves on", async ({ page }) => {
        await startGame(page);
        await turnOnOneQuestionAtATime(page);
        await convertTossup(page);

        await page.getByRole("button", { name: /Next/ }).click();

        // The bonus for question 1, on its own
        await expect(page.getByText(firstBonusText).first()).toBeVisible();
        await expect(page.getByText(firstTossupText).first()).not.toBeVisible();
        await expect(page.getByText("Bonus #1")).toBeVisible();

        await page.getByRole("button", { name: /Next/ }).click();

        await expect(page.getByText(secondTossupText).first()).toBeVisible();
        await expect(page.getByText(firstBonusText).first()).not.toBeVisible();
        await expect(page.getByText("Tossup #2")).toBeVisible();
    });

    test("Next skips the bonus when the tossup goes dead", async ({ page }) => {
        await startGame(page);
        await turnOnOneQuestionAtATime(page);

        await page.getByRole("button", { name: /Next/ }).click();

        await expect(page.getByText(secondTossupText).first()).toBeVisible();
        await expect(page.getByText(firstBonusText).first()).not.toBeVisible();
        await expect(page.getByText("Tossup #2")).toBeVisible();
    });

    test("Previous walks back through the bonus that was read", async ({ page }) => {
        await startGame(page);
        await turnOnOneQuestionAtATime(page);
        await convertTossup(page);

        // tossup 1 -> bonus 1 -> tossup 2
        await page.getByRole("button", { name: /Next/ }).click();
        await page.getByRole("button", { name: /Next/ }).click();
        await expect(page.getByText("Tossup #2")).toBeVisible();

        await page.getByRole("button", { name: /Previous/ }).click();
        await expect(page.getByText("Bonus #1")).toBeVisible();
        await expect(page.getByText(firstBonusText).first()).toBeVisible();

        await page.getByRole("button", { name: /Previous/ }).click();
        await expect(page.getByText("Tossup #1")).toBeVisible();
        await expect(page.getByText(firstTossupText).first()).toBeVisible();
    });

    test("turning the mode off shows both questions again", async ({ page }) => {
        await startGame(page);
        await turnOnOneQuestionAtATime(page);
        await convertTossup(page);
        await page.getByRole("button", { name: /Next/ }).click();
        await expect(page.getByText("Bonus #1")).toBeVisible();

        await turnOnOneQuestionAtATime(page);

        await expect(page.getByText(firstTossupText).first()).toBeVisible();
        await expect(page.getByText(firstBonusText).first()).toBeVisible();
        await expect(page.getByText("Question #1")).toBeVisible();
    });
    // The last tossup can go dead, and the game still has to be exportable: with no correct buzz there is no bonus
    // left to read, so Next has to be the Export button rather than a dead end.
    test("a dead last tossup can still export", async ({ page }) => {
        await startGame(page);
        await turnOnOneQuestionAtATime(page);

        // The sample packet has two tossups, so one Next lands on the last one
        await page.getByRole("button", { name: /Next/ }).click();
        await expect(page.getByText("Tossup #2")).toBeVisible();

        const exportButton = page.getByRole("button", { name: /Export/ });
        await expect(exportButton).toBeVisible();

        await exportButton.click();

        await expect(page.getByRole("heading", { name: "Export to JSON" })).toBeVisible();
        await expect(page.getByRole("button", { name: /Export QBJ/ })).toBeVisible();
    });

    test("the last tossup's bonus is read before exporting", async ({ page }) => {
        await startGame(page);
        await turnOnOneQuestionAtATime(page);
        await page.getByRole("button", { name: /Next/ }).click();
        await expect(page.getByText("Tossup #2")).toBeVisible();

        // Converting the last tossup owes a bonus, so Next stays Next until that bonus has been read
        await convertTossup(page);
        await expect(page.getByRole("button", { name: "Next →" })).toBeVisible();

        await page.getByRole("button", { name: "Next →" }).click();
        await expect(page.getByText("Bonus #2")).toBeVisible();

        await expect(page.getByRole("button", { name: /Export/ })).toBeVisible();
    });
});
