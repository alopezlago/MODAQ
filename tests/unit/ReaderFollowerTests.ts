import { expect } from "chai";

import { ReaderFollower } from "src/speech/ReaderFollower";

// Two tossups read one after another, with the bonus (and some chatter) in between, as the Web Speech engine
// reports them: one utterance key per recognition result, growing interim transcripts, then a final.
const firstTossup: string[] = "In one experiment this scientist shined light on a zinc plate to demonstrate the photoelectric effect while studying sparks between electrodes".split(
    " "
);
const secondTossup: string[] = "This painter depicted a boy in a blue satin costume standing against a stormy landscape for a commission from a hardware merchant".split(
    " "
);

interface IHarness {
    follower: ReaderFollower;
    positions: number[];
    say: (key: string, words: string[], finalize?: boolean) => void;
}

function newHarness(): IHarness {
    const positions: number[] = [];
    const follower: ReaderFollower = new ReaderFollower({
        onPositionChanged: (position) => positions.push(position),
        onPermanentError: () => undefined,
    });
    // Feed transcripts the way an engine does: the utterance grows a word at a time, then is finalized.
    const handle = (follower as unknown) as {
        handleTranscript: (key: string, transcript: string, isFinal: boolean) => void;
    };
    const say = (key: string, words: string[], finalize = true): void => {
        for (let i = 1; i <= words.length; i++) {
            handle.handleTranscript(key, words.slice(0, i).join(" "), false);
        }
        if (finalize) {
            handle.handleTranscript(key, words.join(" "), true);
        }
    };
    return { follower, positions, say };
}

const lastPosition = (positions: number[]): number => (positions.length > 0 ? positions[positions.length - 1] : -1);

describe("ReaderFollowerTests", () => {
    it("Follows the second tossup after the first was answered", () => {
        const h: IHarness = newHarness();
        h.follower.setTargetWords(firstTossup);
        h.say("1-0", firstTossup.slice(0, 12));
        expect(lastPosition(h.positions)).to.be.greaterThan(8);

        // Answered: no tossup is followed while the bonus is read
        h.follower.setTargetWords(undefined);
        h.say("1-1", "for ten points name this physicist answer einstein".split(" "));

        // Next: the second tossup
        h.positions.length = 0;
        h.follower.setTargetWords(secondTossup);
        h.say("1-2", secondTossup.slice(0, 14));
        expect(lastPosition(h.positions)).to.be.greaterThan(9);
    });

    it("Follows the second tossup when Next comes in the middle of an utterance", () => {
        const h: IHarness = newHarness();
        h.follower.setTargetWords(firstTossup);
        h.say("1-0", firstTossup.slice(0, 12));
        h.follower.setTargetWords(undefined);

        // The reader keeps talking through the bonus and straight into tossup two in one recognition result
        const bonusTalk: string[] = "for ten points name this physicist answer einstein question two".split(" ");
        h.say("1-1", bonusTalk, false);
        h.positions.length = 0;
        h.follower.setTargetWords(secondTossup);
        h.say("1-1", [...bonusTalk, ...secondTossup.slice(0, 14)]);
        expect(lastPosition(h.positions)).to.be.greaterThan(9);
    });

    it("Reading the last word moves the position to the end of the question", () => {
        const h: IHarness = newHarness();
        h.follower.setTargetWords(firstTossup);
        h.say("1-0", firstTossup);
        // The end marker comes just after the last target word
        expect(lastPosition(h.positions)).to.equal(firstTossup.length);
    });

    it("Doesn't reach the end before the last word is read", () => {
        const h: IHarness = newHarness();
        h.follower.setTargetWords(firstTossup);
        h.say("1-0", firstTossup.slice(0, firstTossup.length - 1));
        expect(lastPosition(h.positions)).to.be.lessThan(firstTossup.length - 1);
        expect(h.positions).to.not.include(firstTossup.length);
    });

    it("Doesn't reach the end on a last word only partly heard", () => {
        const h: IHarness = newHarness();
        h.follower.setTargetWords(firstTossup);
        // "electrodes" cut off as the recognizer's interim guess
        h.say("1-0", [...firstTossup.slice(0, firstTossup.length - 1), "ele"], false);
        expect(h.positions).to.not.include(firstTossup.length);
        // ...and reaches it once the word is heard
        const handle = (h.follower as unknown) as {
            handleTranscript: (key: string, transcript: string, isFinal: boolean) => void;
        };
        handle.handleTranscript("1-0", firstTossup.join(" "), true);
        expect(lastPosition(h.positions)).to.equal(firstTossup.length);
    });

    it("Follows the second tossup after a recognition session restarts (new keys)", () => {
        const h: IHarness = newHarness();
        h.follower.setTargetWords(firstTossup);
        h.say("1-0", firstTossup.slice(0, 12));
        h.follower.setTargetWords(undefined);
        h.positions.length = 0;
        h.follower.setTargetWords(secondTossup);
        // Session 2 numbers its results from 0 again
        h.say("2-0", secondTossup.slice(0, 14));
        expect(lastPosition(h.positions)).to.be.greaterThan(9);
    });
});
