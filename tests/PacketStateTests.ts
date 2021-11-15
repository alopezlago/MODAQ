import { expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import * as PacketState from "src/state/PacketState";
import { Tossup } from "src/state/PacketState";
import { IFormattedText } from "src/parser/IFormattedText";
import { IGameFormat } from "src/state/IGameFormat";

const noPowersGameFormat: IGameFormat = { ...GameFormats.UndefinedGameFormat, powerMarkers: [], pointsForPowers: [] };
const powersGameFormat: IGameFormat = {
    ...GameFormats.UndefinedGameFormat,
    powers: [{ marker: "(*)", points: 15 }],
};
const superpowersGameFormat: IGameFormat = {
    ...GameFormats.UndefinedGameFormat,
    powers: [
        { marker: "(+)", points: 20 },
        { marker: "(*)", points: 15 },
    ],
};

describe("PacketStateTests", () => {
    describe("formattedQuestionText", () => {
        // Most of these tests are handled by FormattedTextParserTests, so just test that it's hooked up to it and that
        // we include the end character
        it("formattedQuestionText has end marker", () => {
            const tossup: Tossup = new Tossup("This is my question", "Answer");
            const formattedText: IFormattedText[][] = tossup.getWords(noPowersGameFormat).map((word) => word.word);
            expect(formattedText.length).to.equal(5);
            expect(formattedText[0].length).to.equal(1);
            expect(formattedText[0][0].text).to.equal("This");
            expect(formattedText[4].length).to.equal(1);
            expect(formattedText[4][0].text).to.equal("■END■");
        });
        it("formattedQuestionText has formatting", () => {
            const tossup: Tossup = new Tossup("<b>This is</b> my question", "Answer");
            const formattedText: IFormattedText[][] = tossup.getWords(noPowersGameFormat).map((word) => word.word);
            expect(formattedText.length).to.be.greaterThan(1);
            expect(formattedText[0].length).to.equal(1);

            const formattedWord: IFormattedText = formattedText[0][0];
            expect(formattedWord.text).to.equal("This");
            expect(formattedWord.bolded).to.be.true;
            expect(formattedWord.emphasized).to.be.false;
            expect(formattedWord.underlined).to.be.false;
            expect(formattedWord.pronunciation).to.be.false;
        });
        it("formattedQuestionText has pronunciation guide", () => {
            const tossup: Tossup = new Tossup("My question (QWEST-shun) is this.", "Answer");
            const formattedText: IFormattedText[][] = tossup.getWords(noPowersGameFormat).map((word) => word.word);
            expect(formattedText.length).to.be.greaterThan(1);
            expect(formattedText[2].length).to.equal(1);

            const formattedWord: IFormattedText = formattedText[2][0];
            expect(formattedWord.text).to.equal("(QWEST-shun)");
            expect(formattedWord.bolded).to.be.false;
            expect(formattedWord.emphasized).to.be.false;
            expect(formattedWord.underlined).to.be.false;
            expect(formattedWord.pronunciation).to.be.true;
        });
    });

    // Need tests for getBonusWords?
    describe("getBonusWords", () => {
        it("No pronunciation guide in format", () => {
            const formattedText: IFormattedText[] = PacketState.getBonusWords("<b>This is</b> my bonus part", {
                ...GameFormats.ACFGameFormat,
                pronunciationGuideMarkers: undefined,
            });

            expect(formattedText.length).to.equal(2);

            const firstSegment: IFormattedText = formattedText[0];
            expect(firstSegment.text).to.equal("This is");
            expect(firstSegment.pronunciation).to.be.false;
            expect(firstSegment.bolded).to.be.true;

            const secondSegment: IFormattedText = formattedText[1];
            expect(secondSegment.text).to.equal(" my bonus part");
            expect(secondSegment.pronunciation).to.be.false;
            expect(secondSegment.bolded).to.be.false;
        });

        it("With pronunciation guide", () => {
            const formattedText: IFormattedText[] = PacketState.getBonusWords(
                "<b>This is</b> my bonus (BONE-us) part",
                GameFormats.ACFGameFormat
            );

            expect(formattedText.length).to.equal(4);

            expect(formattedText[0].text).to.equal("This is");
            expect(formattedText[0].pronunciation).to.be.false;
            expect(formattedText[0].bolded).to.be.true;

            expect(formattedText[1].text).to.equal(" my bonus ");
            expect(formattedText[1].pronunciation).to.be.false;
            expect(formattedText[1].bolded).to.be.false;

            expect(formattedText[2].text).to.equal("(BONE-us)");
            expect(formattedText[2].pronunciation).to.be.true;
            expect(formattedText[2].bolded).to.be.false;

            expect(formattedText[3].text).to.equal(" part");
            expect(formattedText[3].pronunciation).to.be.false;
            expect(formattedText[3].bolded).to.be.false;
        });

        it("With multiple pronunciation guide", () => {
            const formattedText: IFormattedText[] = PacketState.getBonusWords(
                "<u>Another</u> (an-OTH-er) bonus (BONE-us) part",
                GameFormats.ACFGameFormat
            );

            expect(formattedText.length).to.equal(6);

            expect(formattedText[0].text).to.equal("Another");
            expect(formattedText[0].pronunciation).to.be.false;
            expect(formattedText[0].underlined).to.be.true;

            expect(formattedText[1].text).to.equal(" ");
            expect(formattedText[1].pronunciation).to.be.false;
            expect(formattedText[1].underlined).to.be.false;

            expect(formattedText.slice(2).map((text) => text.underlined)).to.not.contain(true);
            expect(formattedText[2].text).to.equal("(an-OTH-er)");
            expect(formattedText[2].pronunciation).to.be.true;

            expect(formattedText[3].text).to.equal(" bonus ");
            expect(formattedText[3].pronunciation).to.be.false;

            expect(formattedText[4].text).to.equal("(BONE-us)");
            expect(formattedText[4].pronunciation).to.be.true;

            expect(formattedText[5].text).to.equal(" part");
            expect(formattedText[5].pronunciation).to.be.false;
        });

        it("No pronunication guide, but defined in format", () => {
            const formattedText: IFormattedText[] = PacketState.getBonusWords(
                "<b>This is</b> my bonus part",
                GameFormats.ACFGameFormat
            );

            expect(formattedText.length).to.equal(2);
            expect(formattedText.map((text) => text.pronunciation)).to.not.contain(true);

            expect(formattedText[0].text).to.equal("This is");
            expect(formattedText[0].bolded).to.be.true;

            expect(formattedText[1].text).to.equal(" my bonus part");
            expect(formattedText[1].bolded).to.be.false;
        });
    });

    describe("getPointsAtPosition", () => {
        it("No powers", () => {
            const tossup: Tossup = new Tossup("This is my question", "Answer");
            const points: number = tossup.getPointsAtPosition(noPowersGameFormat, 2);
            expect(points).to.equal(10);
        });
        it("Negative value", () => {
            const tossup: Tossup = new Tossup("This is my question", "Answer");
            const points: number = tossup.getPointsAtPosition(noPowersGameFormat, -1);

            // Go with the default if we get a nonsense value
            expect(points).to.equal(10);
        });
        it("At last word", () => {
            const tossup: Tossup = new Tossup("This is my question", "Answer");
            const points: number = tossup.getPointsAtPosition(noPowersGameFormat, tossup.question.length - 1);
            expect(points).to.equal(10);
        });
        it("At end", () => {
            const tossup: Tossup = new Tossup("This is my question", "Answer");
            const points: number = tossup.getPointsAtPosition(noPowersGameFormat, tossup.question.length);
            expect(points).to.equal(10);
        });
        it("In power", () => {
            const tossup: Tossup = new Tossup("This is my (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(powersGameFormat, 2);
            expect(points).to.equal(15);
        });
        it("Out of power", () => {
            const tossup: Tossup = new Tossup("This is my (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(powersGameFormat, 3);
            expect(points).to.equal(10);
        });
        it("In superpower", () => {
            const tossup: Tossup = new Tossup("This is (+) my (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(superpowersGameFormat, 1);
            expect(points).to.equal(20);
        });
        it("In power but not superpower", () => {
            const tossup: Tossup = new Tossup("This is (+) my (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(superpowersGameFormat, 2);
            expect(points).to.equal(15);
        });
        it("Out of power and superpower", () => {
            const tossup: Tossup = new Tossup("This is (+) my (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(superpowersGameFormat, 3);
            expect(points).to.equal(10);
        });
        it("In power with pronunciation guide", () => {
            const gameFormat: IGameFormat = { ...powersGameFormat, pronunciationGuideMarkers: ["(", ")"] };
            const tossup: Tossup = new Tossup("This question (quest-shun) is my (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(gameFormat, 3);
            expect(points).to.equal(15);
        });
        it("In power with multiple pronunciation guides", () => {
            const gameFormat: IGameFormat = { ...powersGameFormat, pronunciationGuideMarkers: ["(", ")"] };
            const tossup: Tossup = new Tossup("This question (quest-shun) is my (mai) (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(gameFormat, 3);
            expect(points).to.equal(15);
        });
        it("In power with pronunciation guide followed by a period", () => {
            const gameFormat: IGameFormat = { ...powersGameFormat, pronunciationGuideMarkers: ["(", ")"] };
            const tossup: Tossup = new Tossup("This is a question (quest-shun). It is my (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(gameFormat, 4);
            expect(points).to.equal(15);
        });
        it("Out of power with pronunciation guide", () => {
            const gameFormat: IGameFormat = { ...powersGameFormat, pronunciationGuideMarkers: ["(", ")"] };
            const tossup: Tossup = new Tossup("This question (quest-shun) is my (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(gameFormat, 4);
            expect(points).to.equal(10);
        });
        it("Out of power with multiple pronunciation guides", () => {
            const gameFormat: IGameFormat = { ...powersGameFormat, pronunciationGuideMarkers: ["(", ")"] };
            const tossup: Tossup = new Tossup("This question (quest-shun) is my (mai) (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(gameFormat, 4);
            expect(points).to.equal(10);
        });
        it("In power with power at last word", () => {
            const tossup: Tossup = new Tossup("This is my question (*)", "Answer");
            const points: number = tossup.getPointsAtPosition(powersGameFormat, 3);
            expect(points).to.equal(15);
        });
        it("In superpower with superpower at last word", () => {
            const tossup: Tossup = new Tossup("This is my question (+)", "Answer");
            const points: number = tossup.getPointsAtPosition(superpowersGameFormat, 3);
            expect(points).to.equal(20);
        });
        it("In power with no superpower in question", () => {
            const tossup: Tossup = new Tossup("This is my (*) question", "Answer");
            const points: number = tossup.getPointsAtPosition(superpowersGameFormat, 2);
            expect(points).to.equal(15);
        });

        // Tossups include a special character to mark the end of the question, which is after the last word in the
        // question, so the last index will be one greater than the number of words in the question.
        it("Wrong before the last word (no powers)", () => {
            const tossup: Tossup = new Tossup("This is my question", "Answer");
            const points: number = tossup.getPointsAtPosition(noPowersGameFormat, 3, false);
            expect(points).to.equal(-5);
        });
        it("Wrong at the last word (no powers)", () => {
            const tossup: Tossup = new Tossup("This is my question", "Answer");
            const points: number = tossup.getPointsAtPosition(noPowersGameFormat, 4, false);
            expect(points).to.equal(0);
        });
        it("Wrong before the last word (pronunciation guide)", () => {
            const tossup: Tossup = new Tossup("This is my question (qwest-shun)", "Answer");
            const points: number = tossup.getPointsAtPosition(noPowersGameFormat, 3, false);
            expect(points).to.equal(-5);
        });
        it("Wrong at the last word (pronunciation guide)", () => {
            const tossup: Tossup = new Tossup("This is my question (qwest-shun)", "Answer");
            const points: number = tossup.getPointsAtPosition(noPowersGameFormat, 4, false);
            expect(points).to.equal(0);
        });
        it("Wrong before the last word (powers)", () => {
            const tossup: Tossup = new Tossup("This is (*) my question", "Answer");
            const points: number = tossup.getPointsAtPosition(powersGameFormat, 3, false);
            expect(points).to.equal(-5);
        });
        it("Wrong at the last word (powers)", () => {
            const tossup: Tossup = new Tossup("This is (*) my question", "Answer");
            const points: number = tossup.getPointsAtPosition(powersGameFormat, 4, false);
            expect(points).to.equal(0);
        });
        it("Wrong before the last word (powers and superpowers)", () => {
            const tossup: Tossup = new Tossup("This is (*) my question", "Answer");
            const points: number = tossup.getPointsAtPosition(superpowersGameFormat, 3, false);
            expect(points).to.equal(-5);
        });
        it("Wrong at the last word (powers and superpowers)", () => {
            const tossup: Tossup = new Tossup("This (+) is (*) my question", "Answer");
            const points: number = tossup.getPointsAtPosition(superpowersGameFormat, 4, false);
            expect(points).to.equal(0);
        });
    });
});
