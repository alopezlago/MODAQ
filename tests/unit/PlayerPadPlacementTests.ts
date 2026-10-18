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
    it("Just below the word when there is room", () => {
        const position = choosePadPosition({ word: rect(100, 200, 50, 20), pad, viewport });
        expect(position.placement).to.equal("belowWord");
        expect(position.top).to.equal(226);
        expect(position.left).to.equal(100);
    });
    it("Above the word when below would run out of the window", () => {
        const position = choosePadPosition({ word: rect(300, 900, 60, 20), pad, viewport });
        expect(position.placement).to.equal("aboveWord");
        expect(position.top).to.equal(900 - 6 - pad.height);
    });
    it("On the roomier side when it fits on neither", () => {
        const short = { width: 1600, height: 300 };
        const nearTop = choosePadPosition({ word: rect(300, 100, 60, 20), pad, viewport: short });
        expect(nearTop.placement).to.equal("belowWord");
        const nearBottom = choosePadPosition({ word: rect(300, 200, 60, 20), pad, viewport: short });
        expect(nearBottom.placement).to.equal("aboveWord");
    });
    it("Never over the word, wherever it lands", () => {
        for (let top = 0; top < 1000; top += 40) {
            const word = rect(200, top, 60, 20);
            const p = choosePadPosition({ word, pad, viewport });
            const overWord = p.top < word.bottom && word.top < p.top + pad.height;
            expect(overWord, `covers the word at ${top} (${p.placement})`).to.be.false;
        }
    });
    it("Kept inside the window, and inside the question column for the compact pad", () => {
        const right = choosePadPosition({ word: rect(1500, 200, 50, 20), pad, viewport });
        expect(right.left + pad.width).to.be.at.most(viewport.width - 8);
        const inColumn = choosePadPosition({
            word: rect(1100, 200, 50, 20),
            pad,
            viewport,
            horizontalBounds: { left: 300, right: 1200 },
        });
        expect(inColumn.left).to.be.at.least(308);
        expect(inColumn.left + pad.width).to.be.at.most(1192);
    });
});
