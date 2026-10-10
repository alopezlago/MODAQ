import { expect } from "chai";

import { choosePadPosition, IPadRect } from "src/components/PlayerPadPlacement";

const viewport = { width: 1600, height: 1000 };
const pad = { width: 600, height: 240 };
const rect = (left: number, top: number, width: number, height: number): IPadRect => ({
    left,
    top,
    right: left + width,
    bottom: top + height,
});

describe("PlayerPadPlacementTests", () => {
    it("Below the word when there is room and the answer is far away", () => {
        const position = choosePadPosition({ word: rect(100, 200, 50, 20), answer: rect(40, 700, 900, 60), pad, viewport });
        expect(position.placement).to.equal("belowWord");
        expect(position.top).to.equal(226);
        expect(position.left).to.equal(100);
    });
    it("Above the word when below would cover the answer (Space near the end of the question)", () => {
        // The word is on the last line; the answer is just under it
        const position = choosePadPosition({ word: rect(300, 500, 60, 20), answer: rect(40, 540, 900, 60), pad, viewport });
        expect(position.placement).to.equal("aboveWord");
        expect(position.top + pad.height).to.be.at.most(500);
    });
    it("Above the word when below would run out of the window", () => {
        const position = choosePadPosition({ word: rect(300, 900, 60, 20), answer: undefined, pad, viewport });
        expect(position.placement).to.equal("aboveWord");
    });
    it("Under the answer when neither side of the word works", () => {
        // A word near the top of a short window, with the answer right under it
        const short = { width: 1600, height: 500 };
        const position = choosePadPosition({ word: rect(300, 100, 60, 20), answer: rect(40, 130, 900, 60), pad, viewport: short });
        expect(position.placement).to.equal("belowAnswer");
        expect(position.top).to.equal(196);
    });
    it("Never over the answer, wherever it lands", () => {
        for (let top = 40; top < 960; top += 40) {
            const word = rect(200, top, 60, 20);
            const answer = rect(40, top + 30, 900, 70);
            const p = choosePadPosition({ word, answer, pad, viewport });
            const padRect = rect(p.left, p.top, pad.width, pad.height);
            const overlaps =
                padRect.left < answer.right &&
                answer.left < padRect.right &&
                padRect.top < answer.bottom &&
                answer.top < padRect.bottom;
            expect(overlaps, `word at ${top} (${p.placement})`).to.be.false;
            const overWord = padRect.top < word.bottom && word.top < padRect.bottom;
            expect(overWord, `covers the word at ${top}`).to.be.false;
        }
    });
    it("An answer off to the side doesn't push the pad away", () => {
        const position = choosePadPosition({ word: rect(100, 300, 50, 20), answer: rect(1300, 330, 200, 40), pad, viewport });
        expect(position.placement).to.equal("belowWord");
    });
    it("Kept inside the window, and inside the question column for the compact pad", () => {
        const right = choosePadPosition({ word: rect(1500, 200, 50, 20), answer: undefined, pad, viewport });
        expect(right.left + pad.width).to.be.at.most(viewport.width - 8);
        const inColumn = choosePadPosition({
            word: rect(1100, 200, 50, 20),
            answer: undefined,
            pad,
            viewport,
            horizontalBounds: { left: 300, right: 1200 },
        });
        expect(inColumn.left).to.be.at.least(308);
        expect(inColumn.left + pad.width).to.be.at.most(1192);
    });
});
