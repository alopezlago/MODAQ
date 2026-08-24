import fs from "fs";
import { test, expect, Download } from "@playwright/test";
import { startGame } from "./game.fixture";

const errataText = "The answer line should also accept 'Georgian'.";

test.describe("errata", () => {
    test("a moderator can note an erratum from the question and export it on its own", async ({ page }) => {
        await startGame(page);

        // The flag sits in the question's top right corner, next to the throw-out button
        const tossupErrataButton = page.getByRole("button", { name: /Note an erratum for tossup 1/ });
        await expect(tossupErrataButton).toBeVisible();
        await expect(page.getByRole("button", { name: /Note an erratum for bonus 1/ })).toBeVisible();

        await tossupErrataButton.click();
        await expect(page.getByRole("heading", { name: "Errata for Tossup 1" })).toBeVisible();

        await page.getByLabel("What was wrong with this question?").fill(errataText);
        await page.getByRole("button", { name: "Save" }).click();

        // The flag now reports the erratum it's holding
        await expect(page.getByRole("button", { name: `Erratum: ${errataText}` })).toBeVisible();

        // Exporting the QBJ brings the errata down beside it, in a file of their own, so the QBJ stays importable
        await page.getByRole("menuitem", { name: "Export" }).click();
        await page.getByRole("menuitem", { name: "Export to JSON..." }).click();

        const exportButton = page.getByRole("button", { name: "Export QBJ (+ 1 errata)" });
        await expect(exportButton).toBeVisible();

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

        // The export has to say which question it's about and what the moderator wrote
        const erratum = contents.errata[0];
        expect(erratum.question).toEqual("Tossup 1");
        expect(erratum.questionNumber).toEqual(1);
        expect(erratum.questionType).toEqual("tossup");
        expect(erratum.errata).toEqual(errataText);
        expect(erratum.questionText).toContain("His farewell address");
    });

    test("an erratum can be edited and removed from the question's flag", async ({ page }) => {
        await startGame(page);

        await page.getByRole("button", { name: /Note an erratum for tossup 1/ }).click();
        await page.getByLabel("What was wrong with this question?").fill(errataText);
        await page.getByRole("button", { name: "Save" }).click();

        // Reopening starts from what was written before
        await page.getByRole("button", { name: `Erratum: ${errataText}` }).click();
        await expect(page.getByLabel("What was wrong with this question?")).toHaveValue(errataText);

        await page.getByRole("button", { name: "Remove" }).click();
        await expect(page.getByRole("button", { name: /Note an erratum for tossup 1/ })).toBeVisible();

        // With no errata left, the export is just the QBJ
        await page.getByRole("menuitem", { name: "Export" }).click();
        await page.getByRole("menuitem", { name: "Export to JSON..." }).click();
        await expect(page.getByRole("button", { name: "Export QBJ", exact: true })).toBeVisible();
    });
});
