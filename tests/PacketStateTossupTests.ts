import { expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
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

describe("PacketStateTossupTests", () => {
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
            expect(formattedText[4][0].text).to.equal("■");
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
