import { expect } from "chai";

import { IClickTargetElement, wordIndexFromClickTarget } from "src/components/TossupQuestionController";

// A small stand-in for the DOM the question text renders: each QuestionWord is a focusable span (with data-index
// when buzzable, data-pronunciation on a guide), and a word's text may sit in spans of its own inside it.
class FakeElement implements IClickTargetElement {
    public previousElementSibling: FakeElement | null = null;

    constructor(private readonly attributes: Record<string, string>, private readonly parent: FakeElement | null = null) {}

    public getAttribute(name: string): string | null {
        return this.attributes[name] ?? null;
    }

    public closest(selector: string): FakeElement | null {
        const match = /^\[([\w-]+)="([^"]*)"\]$/.exec(selector);
        if (match == null) {
            throw new Error("FakeElement only understands [name=\"value\"] selectors: " + selector);
        }

        if (this.getAttribute(match[1]) === match[2]) {
            return this;
        }

        return this.parent?.closest(selector) ?? null;
    }
}

// Lays words out as siblings, in order, the way TossupQuestion renders them.
function row(...words: FakeElement[]): FakeElement[] {
    for (let i = 1; i < words.length; i++) {
        words[i].previousElementSibling = words[i - 1];
    }

    return words;
}

const word = (index: number): FakeElement => new FakeElement({ "data-is-focusable": "true", "data-index": `${index}` });
const guide = (): FakeElement => new FakeElement({ "data-is-focusable": "true", "data-pronunciation": "true" });
const powerMarker = (): FakeElement => new FakeElement({ "data-is-focusable": "true" });

describe("BuzzPointClickTests", () => {
    describe("wordIndexFromClickTarget", () => {
        it("A plain word", () => {
            const [, wiley] = row(word(3), word(4));
            expect(wordIndexFromClickTarget(wiley)).to.equal(4);
        });
        it("Text inside the word's own spans (an anchored pronunciation guide's word)", () => {
            // <span data-index=4><div><span class=pronunciationTarget><b>Kehinde</b></span></div></span>
            const [, kehinde] = row(word(3), word(4));
            const formattedText = new FakeElement({ class: "text" }, kehinde);
            const anchorSpan = new FakeElement({ class: "pronunciationTarget" }, formattedText);
            const bold = new FakeElement({}, anchorSpan);
            expect(wordIndexFromClickTarget(anchorSpan)).to.equal(4);
            expect(wordIndexFromClickTarget(bold)).to.equal(4);
        });
        it("The guide itself means the word it is for", () => {
            const [, , pg] = row(word(3), word(4), guide());
            const inner = new FakeElement({ class: "pronunciationGuide" }, pg);
            expect(wordIndexFromClickTarget(pg)).to.equal(4);
            expect(wordIndexFromClickTarget(inner)).to.equal(4);
        });
        it("A guide over several words (and something between words) still finds its word", () => {
            const between = new FakeElement({ class: "buzz-menu" });
            const [, , , pg1, pg2] = row(word(3), word(4), between, guide(), guide());
            expect(wordIndexFromClickTarget(pg1)).to.equal(4);
            expect(wordIndexFromClickTarget(pg2)).to.equal(4);
        });
        it("A power marker is not a buzz point, and a guide after one has no word", () => {
            const [, marker, pg] = row(word(3), powerMarker(), guide());
            expect(wordIndexFromClickTarget(marker)).to.be.undefined;
            expect(wordIndexFromClickTarget(pg)).to.be.undefined;
        });
        it("Outside any word", () => {
            expect(wordIndexFromClickTarget(new FakeElement({ class: "tuNumber" }))).to.be.undefined;
            expect(wordIndexFromClickTarget(null)).to.be.undefined;
        });
    });
});
