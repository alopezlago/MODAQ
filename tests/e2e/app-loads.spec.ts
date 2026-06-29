import { test, expect } from "@playwright/test";

test.describe("app loads", () => {
    test("page title is correct", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/Moderator Assistant for Quizbowl/i);
    });

    test("New Game button is visible in the command bar", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("menuitem", { name: "New game", exact: true }).first()).toBeVisible();
    });

    test("no game is active on first load", async ({ page }) => {
        await page.goto("/");
        // The question viewer and scoreboard are not rendered until a game is started.
        await expect(page.getByText("Team 1")).not.toBeVisible();
        await expect(page.getByText("Team 2")).not.toBeVisible();
    });
});
