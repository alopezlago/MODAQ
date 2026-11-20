import fs from "fs";
import { test, expect, Download, Page } from "@playwright/test";
import { startGame } from "./game.fixture";

const errataText = "The answer line should also accept 'Georgian'.";

// The sample packet has two tossups, so the second one is the last question of the round
async function goToLastQuestion(page: Page): Promise<void> {
    await page.getByRole("button", { name: /Next/ }).click();
    await expect(page.getByRole("button", { name: "Export..." })).toBeVisible();
}

test.describe("errata", () => {
    test("R marks the current question, and the details are added at the end of the round", async ({ page }) => {
        await startGame(page);

        // R only marks the question; nothing opens while the moderator is reading
        await page.keyboard.press("r");
        await expect(page.getByRole("button", { name: /Erratum marked for tossup 1/ })).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);

        await goToLastQuestion(page);

        // Finishing the round brings up the review before the export
        await page.getByRole("button", { name: "Export..." }).click();
        await expect(page.getByRole("heading", { name: "Review errata" })).toBeVisible();
        await page.getByLabel("What was wrong with Tossup 1?").fill(errataText);
        await page.getByRole("button", { name: "Continue to export" }).click();

        const exportButton = page.getByRole("link", { name: "Export QBJ" });
        await expect(exportButton).toBeVisible();
        await expect(page.getByText(/The 1 errata you noted/)).toBeVisible();

        const downloads: Download[] = [];
        page.on("download", (download) => downloads.push(download));
        await exportButton.click();
        await expect.poll(() => downloads.length).toEqual(2);

        const filenames: string[] = downloads.map((download) => download.suggestedFilename());
        expect(filenames.filter((name) => name.endsWith(".qbj"))).toHaveLength(1);

        const errataDownload = downloads.find((download) => download.suggestedFilename().endsWith("_Errata.json"));
        if (errataDownload == undefined) {
            throw new Error(`No errata file was downloaded; got ${filenames.join(", ")}`);
        }

        const contents = JSON.parse(fs.readFileSync(await errataDownload.path(), "utf-8"));
        expect(contents.type).toEqual("modaq-errata");
        expect(contents.teams).toEqual(["Team Alpha", "Team Beta"]);
        expect(contents.errata).toHaveLength(1);

        const erratum = contents.errata[0];
        expect(erratum.question).toEqual("Tossup 1");
        expect(erratum.questionNumber).toEqual(1);
        expect(erratum.questionType).toEqual("tossup");
        expect(erratum.errata).toEqual(errataText);
        expect(erratum.questionText).toContain("His farewell address");
    });

    test("the flag toggles the mark, and errata can be removed in the review", async ({ page }) => {
        await startGame(page);

        // Clicking the flag twice unmarks the question
        await page.getByRole("button", { name: /Mark an erratum for tossup 1/ }).click();
        await page.getByRole("button", { name: /Erratum marked for tossup 1/ }).click();
        await expect(page.getByRole("button", { name: /Mark an erratum for tossup 1/ })).toBeVisible();

        await page.getByRole("button", { name: /Mark an erratum for bonus 1/ }).click();
        await expect(page.getByRole("button", { name: /Erratum marked for bonus 1/ })).toBeVisible();

        await goToLastQuestion(page);
        await page.getByRole("button", { name: "Export..." }).click();
        await expect(page.getByLabel("What was wrong with Bonus 1?")).toBeVisible();
        await expect(page.getByLabel("What was wrong with Tossup 1?")).toHaveCount(0);

        await page.getByRole("button", { name: "Remove the erratum for Bonus 1" }).click();
        await expect(page.getByText("No questions are marked as having errata.")).toBeVisible();
        await page.getByRole("button", { name: "Continue to export" }).click();

        // With no errata left, the export is just the QBJ
        await expect(page.getByRole("link", { name: "Export QBJ" })).toBeVisible();
        await expect(page.getByText(/errata you noted/)).toHaveCount(0);
    });

    test("without errata, finishing the round goes straight to the export", async ({ page }) => {
        await startGame(page);
        await goToLastQuestion(page);

        await page.getByRole("button", { name: "Export..." }).click();

        await expect(page.getByRole("link", { name: "Export QBJ" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Review errata" })).toHaveCount(0);
    });
});
