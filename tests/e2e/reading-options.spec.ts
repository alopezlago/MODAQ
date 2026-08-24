import path from "path";
import fs from "fs";
import os from "os";
import { test, expect, Page } from "@playwright/test";
import { openNewGameDialog, PLAYER_ALICE, PLAYER_BOB, TEAM_ALPHA, TEAM_BETA } from "./game.fixture";

// A YAPP2 packet with a <pg> anchor, so the anchor styling has something to attach to
const anchoredPacketPath = path.join(os.tmpdir(), "modaq-anchored-packet.json");

test.beforeAll(() => {
    fs.writeFileSync(
        anchoredPacketPath,
        JSON.stringify({
            name: "Anchored Packet",
            version: "yapp2/1.1",
            tossups: [
                {
                    question:
                        "This author of <pg>Goethe</pg> (GUR-tuh) wrote a famous play. For 10 points, name this writer.",
                    answer: "Johann von <b><u>Goethe</u></b>",
                },
            ],
            bonuses: [
                {
                    leadin: "A bonus, for 10 points each.",
                    parts: ["Name this city."],
                    answers: ["Madrid"],
                    values: [10],
                },
            ],
        })
    );
});

async function startGameWithAnchoredPacket(page: Page): Promise<void> {
    await page.goto("/");
    await openNewGameDialog(page);
    await page.getByLabel("First team").fill(TEAM_ALPHA);
    await page.getByLabel("Name").nth(0).fill(PLAYER_ALICE);
    await page.getByLabel("Second team").fill(TEAM_BETA);
    await page.getByLabel("Name").nth(4).fill(PLAYER_BOB);
    await page.locator('input[type="file"][accept*="application/json"]').setInputFiles(anchoredPacketPath);
    await page.getByText('Packet "Anchored Packet" loaded.').waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByText(TEAM_ALPHA).first().waitFor({ state: "visible" });
}

test.describe("reading options", () => {
    test("pronunciation anchors can be turned off", async ({ page }) => {
        await startGameWithAnchoredPacket(page);

        // Anchored words are colored maroon; turning the option off leaves them styled like any other word
        const anchorColor = () =>
            page.evaluate(() => {
                const anchor = Array.from(document.querySelectorAll("span")).find(
                    (span) => span.textContent === "Goethe" && span.className.indexOf("pronunciationTarget") >= 0
                );
                return anchor == undefined
                    ? undefined
                    : {
                          color: getComputedStyle(anchor).color,
                          decoration: getComputedStyle(anchor).textDecorationLine,
                      };
            });

        // Maroon, and no underline: underlining competes with the packet's own formatting
        expect(await anchorColor()).toEqual({ color: "rgb(128, 0, 0)", decoration: "none" });

        await page.getByRole("menuitem", { name: "View" }).click();
        await page.getByRole("menuitemcheckbox", { name: "Pronunciation anchors" }).click();

        expect(await anchorColor()).toBeUndefined();
        // The guide itself still reads
        await expect(page.getByText("(GUR-tuh)")).toBeVisible();
    });

    // The anchored word has a span of its own inside the word, which the click handler used to stop at, so the
    // buzz menu never opened on exactly the words a guide points at
    test("clicking an anchored word opens the buzz menu", async ({ page }) => {
        await startGameWithAnchoredPacket(page);

        await page.getByText("Goethe", { exact: true }).first().click();

        await expect(page.getByRole("menuitem", { name: /Alice/ })).toBeVisible();
    });

    test("the space for word numbers can be collapsed, and the numbers still show", async ({ page }) => {
        await startGameWithAnchoredPacket(page);

        const questionTextHeight = () =>
            page.evaluate(() => {
                const word = document.querySelector("[data-index='0']") as HTMLElement;
                return (word.closest("div") as HTMLElement).getBoundingClientRect().height;
            });

        await page.getByRole("menuitem", { name: "Options" }).click();
        await page.getByRole("menuitemcheckbox", { name: "Type word number to buzz (Space)" }).click();
        const reservedHeight: number = await questionTextHeight();

        await page.getByRole("menuitem", { name: "Options" }).click();
        await page.getByRole("menuitemcheckbox", { name: "Reserve space for word numbers" }).click();
        expect(await questionTextHeight()).toBeLessThan(reservedHeight);

        // Collapsing the space only affects the reading view; pressing Space still numbers the words
        await page.locator("body").click({ position: { x: 5, y: 400 } });
        await page.keyboard.press(" ");
        await expect(page.locator("[data-index='0']")).toContainText("1");
    });
});
