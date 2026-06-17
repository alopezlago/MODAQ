import { expect } from "chai";

import {
    IncrementalTranscriptProcessor,
    TranscriptAligner,
    normalizeSpokenWord,
} from "src/speech/TranscriptAligner";

const questionWords: string[] = "In one experiment, this scientist shined light on a zinc plate to demonstrate the photoelectric effect".split(
    " "
);

describe("TranscriptAlignerTests", () => {
    describe("normalizeSpokenWord", () => {
        it("Lowercases and strips punctuation", () => {
            expect(normalizeSpokenWord("Hertz,")).to.equal("hertz");
            expect(normalizeSpokenWord('"experiment."')).to.equal("experiment");
            expect(normalizeSpokenWord("don't")).to.equal("dont");
        });
        it("Strips accents", () => {
            expect(normalizeSpokenWord("Müller")).to.equal("muller");
            expect(normalizeSpokenWord("Galápagos")).to.equal("galapagos");
        });
    });

    describe("processTranscript", () => {
        it("Initial position is -1", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            expect(aligner.currentPosition).to.equal(-1);
        });
        it("Follows exact reading", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            expect(aligner.processTranscript("In one experiment")).to.equal(2);
            expect(aligner.processTranscript("this scientist shined")).to.equal(5);
        });
        it("Ignores punctuation and casing differences", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            expect(aligner.processTranscript("in ONE experiment this")).to.equal(3);
        });
        it("Recovers from misrecognized words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);

            // "shined" misheard as "shy and"; the aligner should pick back up at "light"
            expect(aligner.processTranscript("this scientist shy and light on a zinc")).to.equal(9);
        });
        it("Handles a stumble that repeats recent words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist");

            // The reader stumbles and re-reads the last couple of words; position shouldn't go backwards or
            // skip ahead
            expect(aligner.processTranscript("this scientist shined")).to.equal(5);
        });
        it("Handles a stumbled word fragment", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist shined light on a zinc plate to demonstrate the photo");

            // The fragment "photo" matches "photoelectric" via the prefix rule
            expect(aligner.currentPosition).to.equal(questionWords.indexOf("photoelectric"));

            // Re-reading the stumbled word shouldn't move us past it, and the rest of the reading should continue
            // from there
            expect(aligner.processTranscript("the photoelectric effect")).to.equal(questionWords.length - 1);
        });
        it("Matches slightly misrecognized long words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            expect(aligner.processTranscript("in one experimence")).to.equal(2);
        });
        it("Doesn't fuzzily match short words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(["a", "cat", "sat"]);
            expect(aligner.processTranscript("b")).to.equal(-1);
            expect(aligner.processTranscript("can")).to.equal(-1);
        });
        it("Never moves backwards", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist shined light");
            const position: number = aligner.currentPosition;

            aligner.processTranscript("scientist shined");
            expect(aligner.currentPosition).to.equal(position);
        });
        it("A lone word matching far ahead doesn't move the position", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);

            // "effect" is the last word; a single stray match far ahead shouldn't move the position
            expect(aligner.processTranscript("effect")).to.equal(-1);
        });
        it("Resyncs when the position falls far behind the reader", () => {
            const text: string[] = (
                "Sulfides lost from boxwork structures in the supergene accumulate at this entity which separates " +
                "oxidative processes from reducing ones Regions of cracked sandstone can be perched on clay above " +
                "this entity"
            ).split(" ");
            const aligner: TranscriptAligner = new TranscriptAligner(text);

            aligner.processTranscript("Sulfides lost from");
            expect(aligner.currentPosition).to.equal(2);

            // The recognizer mangled a long stretch and the reader is now far ahead; several consecutive words
            // agreeing at the new location resync the position
            aligner.processTranscript("Regions of cracked sandstone can be perched");
            expect(aligner.currentPosition).to.equal(text.indexOf("perched"));
        });
        it("Ignores unrelated speech", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment");
            expect(aligner.processTranscript("hold on let me fix the buzzer system")).to.equal(2);
        });
        it("Stops at the last word", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(["the", "photoelectric", "effect"]);
            aligner.processTranscript("the photoelectric effect effect effect");
            expect(aligner.currentPosition).to.equal(2);
        });
        it("A short word match ahead doesn't move the position by itself", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist");

            // "on" appears a few words ahead, but a short common word alone shouldn't move the position
            expect(aligner.processTranscript("on")).to.equal(4);

            // Continuing normally still works afterwards
            expect(aligner.processTranscript("shined light")).to.equal(6);
        });
        it("A single dropped word recovers with two agreeing words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist");

            // The recognizer missed "shined"; "light" alone is tentative, and "on" right after confirms the
            // near skip
            expect(aligner.processTranscript("light on")).to.equal(7);
        });
        it("A far skip needs three agreeing words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist");

            // The recognizer missed "shined light"; two matching words further ahead aren't enough...
            expect(aligner.processTranscript("on a")).to.equal(4);

            // ...but a third agreeing word commits the skip
            expect(aligner.processTranscript("zinc")).to.equal(9);
        });
        it("A distinctive word match needs more words to skip far ahead", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist", 1000);

            // A few seconds later the reader is at "demonstrate" (a plausible distance for the elapsed time).
            // Even longer words can repeat within a question, so a skip match alone doesn't move the position,
            // and far skips need three agreeing words.
            expect(aligner.processTranscript("demonstrate the", 4000)).to.equal(4);
            expect(aligner.processTranscript("photoelectric", 4500)).to.equal(questionWords.indexOf("photoelectric"));
        });
        it("A re-heard repeated phrase doesn't jump to its next occurrence", () => {
            const text: string[] = (
                "A man in this place believes that grey eyes are the keenest " +
                "A man at this place watches a piece of dancing driftwood"
            ).split(" ");
            const aligner: TranscriptAligner = new TranscriptAligner(text);

            aligner.processTranscript("A man in this place believes that grey eyes are the keenest");
            expect(aligner.currentPosition).to.equal(11);

            // The recognizer revises its guess and re-emits part of the sentence; "this place" also appears in
            // the next sentence, but the position shouldn't jump there
            expect(aligner.processTranscript("this place")).to.equal(11);

            // Reading on normally still works
            expect(aligner.processTranscript("A man at this place watches")).to.equal(17);
        });
        it("Recognizer spelling differences still match", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(["the", "grey", "eyes"]);

            // Speech recognizers normalize spelling ("gray" for "grey"); that shouldn't break the next-word match
            expect(aligner.processTranscript("the gray eyes")).to.equal(2);
        });
        it("Rejects a far jump that outpaces the reading speed in a short time", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one", 1000);

            // "demonstrate the photoelectric effect" matches far ahead, but only 0.2s passed — the reader
            // couldn't have read that far that fast, so the jump needs more evidence than these words provide
            expect(aligner.processTranscript("demonstrate the photoelectric effect", 1200)).to.equal(1);
        });
        it("Allows the same far jump once enough time has passed (resync from being stuck)", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one", 1000);

            // The position stalled for 5s while the reader kept going; the jump is now plausible and the stuck
            // position should resync
            expect(aligner.processTranscript("demonstrate the photoelectric effect", 6000)).to.equal(15);
        });
        it("An unconfirmed pending skip is discarded", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist");

            // "on" suggests a skip, but unrelated speech follows, so the skip never happens
            aligner.processTranscript("on whatever");
            expect(aligner.currentPosition).to.equal(4);
        });
    });

    describe("IncrementalTranscriptProcessor", () => {
        it("Growing partial transcripts don't double-count words", () => {
            const processor: IncrementalTranscriptProcessor = new IncrementalTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            // The same utterance grows as the recognizer hears more; words shouldn't be processed twice
            expect(processor.process("u1", "In", false).position).to.equal(0);
            expect(processor.process("u1", "In one", false).position).to.equal(1);
            expect(processor.process("u1", "In one experiment", false).position).to.equal(2);
        });
        it("Reports only new words", () => {
            const processor: IncrementalTranscriptProcessor = new IncrementalTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            expect(processor.process("u1", "In one", false).newWords).to.deep.equal(["In", "one"]);
            expect(processor.process("u1", "In one correct", false).newWords).to.deep.equal(["correct"]);

            // The repeated transcript has no new words
            expect(processor.process("u1", "In one correct", false).newWords).to.deep.equal([]);
        });
        it("Final transcript processes remaining words and starts a new utterance", () => {
            const processor: IncrementalTranscriptProcessor = new IncrementalTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            processor.process("u1", "In one", false);
            expect(processor.process("u1", "In one experiment", true).position).to.equal(2);

            // A new utterance starts fresh; its words are all new
            expect(processor.process("u2", "this scientist", false).position).to.equal(4);
        });
        it("New utterance key resets consumption", () => {
            const processor: IncrementalTranscriptProcessor = new IncrementalTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            processor.process("u1", "In one experiment", false);

            // The recognizer never finalized u1, but a new utterance arrived; all of its words should process
            expect(processor.process("u2", "this scientist shined", false).position).to.equal(5);
        });
        it("Shortened revisions don't reprocess words", () => {
            const processor: IncrementalTranscriptProcessor = new IncrementalTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            processor.process("u1", "In one experiment", false);

            // The recognizer revised its guess to fewer words; nothing new should process
            expect(processor.process("u1", "In one", false).position).to.equal(2);

            // And re-growing to the same length shouldn't re-process "experiment"
            expect(processor.process("u1", "In one experiment", false).position).to.equal(2);

            // But growing beyond it should pick up the new word
            expect(processor.process("u1", "In one experiment this", false).position).to.equal(3);
        });
    });
});
