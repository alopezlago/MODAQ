import { expect } from "chai";

import { TranscriptAligner, UtteranceTranscriptProcessor, normalizeSpokenWord } from "src/speech/TranscriptAligner";
import { getTokenSimilarity, tokenizeSpeechText } from "src/speech/SpeechText";

// A target with a phrase ("beta gamma") that repeats, so a spoken occurrence can match a later position than
// the reader is actually at -- the situation that lets a speculative interim overshoot.
const repeatedPhraseWords: string[] = "alpha beta gamma delta beta gamma omega".split(" ");

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

    describe("tokenizeSpeechText", () => {
        it("Splits hyphenated and slashed words", () => {
            expect(tokenizeSpeechText("Franco-Prussian")).to.deep.equal(["franco", "prussian"]);
            expect(tokenizeSpeechText("and/or")).to.deep.equal(["and", "or"]);
            expect(tokenizeSpeechText("war—the")).to.deep.equal(["war", "the"]);
        });
        it("Strips punctuation, apostrophes, and abbreviation periods", () => {
            expect(tokenizeSpeechText('"Don\'t," (U.S.)')).to.deep.equal(["dont", "us"]);
        });
        it("Spells out years in pairs", () => {
            expect(tokenizeSpeechText("1848")).to.deep.equal(["eighteen", "forty", "eight"]);
            expect(tokenizeSpeechText("1905")).to.deep.equal(["nineteen", "oh", "five"]);
            expect(tokenizeSpeechText("1900")).to.deep.equal(["nineteen", "hundred"]);
        });
        it("Spells out other numbers", () => {
            expect(tokenizeSpeechText("15")).to.deep.equal(["fifteen"]);
            expect(tokenizeSpeechText("10,000")).to.deep.equal(["ten", "thousand"]);
            expect(tokenizeSpeechText("3.5")).to.deep.equal(["three", "point", "five"]);
            expect(tokenizeSpeechText("2003")).to.deep.equal(["two", "thousand", "three"]);
        });
        it("Spells out ordinals and decades", () => {
            expect(tokenizeSpeechText("19th")).to.deep.equal(["nineteenth"]);
            expect(tokenizeSpeechText("21st")).to.deep.equal(["twenty", "first"]);
            expect(tokenizeSpeechText("1960s")).to.deep.equal(["nineteen", "sixties"]);
        });
    });

    describe("getTokenSimilarity", () => {
        it("Identical words are fully similar", () => {
            expect(getTokenSimilarity("zinc", "zinc")).to.equal(1);
        });
        it("Spelling variants are similar", () => {
            expect(getTokenSimilarity("gray", "grey")).to.be.at.least(0.7);
            expect(getTokenSimilarity("chaikovsky", "tchaikovsky")).to.be.at.least(0.8);
        });
        it("Different short words aren't similar", () => {
            expect(getTokenSimilarity("in", "on")).to.be.below(0.65);
            expect(getTokenSimilarity("the", "to")).to.be.below(0.65);
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
        it("Follows word by word", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            questionWords.forEach((word, index) => {
                expect(aligner.processTranscript(word)).to.equal(index);
            });
        });
        it("Ignores punctuation and casing differences", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            expect(aligner.processTranscript("in ONE experiment this")).to.equal(3);
        });
        it("Recovers from misrecognized words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);

            // "shined" misheard as "shy and"; the aligner should pick back up at "light"
            expect(aligner.processTranscript("In one experiment this scientist shy and light on a zinc")).to.equal(9);
        });
        it("Keeps going through scattered misrecognitions", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment");

            // Every other content word is wrong, so there's never a run of consecutive matches; the alignment
            // still lines up the words that did match
            expect(
                aligner.processTranscript("this signed his shined light on a sink plate to demonstrate the")
            ).to.equal(13);
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
            aligner.processTranscript(
                "In one experiment this scientist shined light on a zinc plate to demonstrate the"
            );
            expect(aligner.currentPosition).to.equal(13);

            // Re-reading after a fragment continues from there
            aligner.processTranscript("photo");
            expect(aligner.processTranscript("the photoelectric effect")).to.equal(questionWords.length - 1);
        });
        it("Matches slightly misrecognized long words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            expect(aligner.processTranscript("in one experimence")).to.equal(2);
        });
        it("Matches a hyphenated word read as two words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner("the Franco-Prussian War ended".split(" "));
            expect(aligner.processTranscript("the franco prussian war")).to.equal(2);
        });
        it("Matches a word the recognizer split in two", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript(
                "In one experiment this scientist shined light on a zinc plate to demonstrate the"
            );
            expect(aligner.processTranscript("photo electric effect")).to.equal(questionWords.length - 1);
        });
        it("Matches a year written as digits when it's heard as words, and vice versa", () => {
            const text: string[] = "In 1848 revolutions spread across Europe".split(" ");

            const wordsAligner: TranscriptAligner = new TranscriptAligner(text);
            expect(wordsAligner.processTranscript("in eighteen forty eight revolutions")).to.equal(2);

            const digitsAligner: TranscriptAligner = new TranscriptAligner(
                "In eighteen forty-eight revolutions".split(" ")
            );
            expect(digitsAligner.processTranscript("in 1848 revolutions")).to.equal(3);
        });
        it("Doesn't fuzzily match short words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(["a", "cat", "sat"]);
            expect(aligner.processTranscript("b")).to.equal(-1);
            expect(aligner.processTranscript("can")).to.equal(-1);
        });
        it("Doesn't move backwards on re-heard words", () => {
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

            aligner.processTranscript("Sulfides lost from", 1000);
            expect(aligner.currentPosition).to.equal(2);

            // The recognizer mangled a long stretch and the reader is now far ahead; several words agreeing at the
            // new location resync the position
            aligner.processTranscript("boks were structures and the super jean accumulate it this", 4000);
            aligner.processTranscript("entity witch separate oxide processes from reducing", 6000);
            aligner.processTranscript("Regions of cracked sandstone can be perched", 8000);
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
        it("A single dropped word recovers on the next content word", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist");

            // The recognizer missed "shined"
            expect(aligner.processTranscript("light on")).to.equal(7);
        });
        it("A far skip needs more than a couple of weak words", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one experiment this scientist");

            // The recognizer missed "shined light"; "on a" further ahead isn't enough...
            expect(aligner.processTranscript("on a")).to.equal(4);

            // ...but a distinctive word agreeing with them commits the skip
            expect(aligner.processTranscript("zinc")).to.equal(9);
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
        it("A re-heard phrase doesn't skip a word to reach its next occurrence", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(repeatedPhraseWords);
            expect(aligner.processTranscript("alpha beta gamma")).to.equal(2);
            expect(aligner.processTranscript("beta gamma")).to.equal(2);
            expect(aligner.processTranscript("delta beta gamma")).to.equal(5);
        });
        it("Recognizer spelling differences still match", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(["the", "grey", "eyes"]);

            // Speech recognizers normalize spelling ("gray" for "grey"); that shouldn't break the next-word match
            expect(aligner.processTranscript("the gray eyes")).to.equal(2);
        });
        it("Rejects a far jump that outpaces the reading speed", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one", 1000);

            // "demonstrate the photoelectric" matches far ahead, but only 0.2s passed and only three words were
            // heard -- the reader couldn't have read that far that fast, so they aren't enough evidence
            expect(aligner.processTranscript("demonstrate the photoelectric", 1200)).to.equal(1);
        });
        it("Allows the same far jump once enough time has passed (resync from being stuck)", () => {
            const aligner: TranscriptAligner = new TranscriptAligner(questionWords);
            aligner.processTranscript("In one", 1000);

            // The position stalled for 5s while the reader kept going; the jump is now plausible
            expect(aligner.processTranscript("demonstrate the photoelectric", 6000)).to.equal(14);
        });
        it("Recovers from a wrong jump ahead when the reading continues behind it", () => {
            const text: string[] = (
                "This author wrote about a lighthouse keeper whose daughter marries a sailor. " +
                "In another novel by this author a lighthouse keeper whose daughter rows out in a storm " +
                "saves a ship and later becomes famous for it before she dies of consumption"
            ).split(" ");
            const aligner: TranscriptAligner = new TranscriptAligner(text);
            aligner.processTranscript("This author wrote about", 1000);

            // Simulate an earlier bad jump to the second "lighthouse keeper whose daughter"
            const secondKeeper: number = text.lastIndexOf("daughter");
            aligner.setState({ ...aligner.getState(), tokenPosition: secondKeeper });

            // The reader is really in the first sentence and keeps reading it
            aligner.processTranscript("a lighthouse keeper whose daughter marries a sailor", 3000);
            expect(aligner.currentPosition).to.equal(text.indexOf("sailor."));
        });
    });

    describe("UtteranceTranscriptProcessor", () => {
        it("Advances as partial transcripts grow", () => {
            const processor: UtteranceTranscriptProcessor = new UtteranceTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            expect(processor.process("u1", "In", false).position).to.equal(0);
            expect(processor.process("u1", "In one", false).position).to.equal(1);
            expect(processor.process("u1", "In one experiment", false).position).to.equal(2);
        });
        it("Reports only new words", () => {
            const processor: UtteranceTranscriptProcessor = new UtteranceTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            expect(processor.process("u1", "In one", false).newWords).to.deep.equal(["In", "one"]);
            expect(processor.process("u1", "In one correct", false).newWords).to.deep.equal(["correct"]);

            // The repeated transcript has no new words
            expect(processor.process("u1", "In one correct", false).newWords).to.deep.equal([]);
        });
        it("A final transcript ends the utterance; the next one continues from it", () => {
            const processor: UtteranceTranscriptProcessor = new UtteranceTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            processor.process("u1", "In one", false);
            expect(processor.process("u1", "In one experiment", true).position).to.equal(2);
            expect(processor.process("u2", "this scientist", false).position).to.equal(4);
        });
        it("A new utterance key keeps the unfinalized previous utterance's position", () => {
            const processor: UtteranceTranscriptProcessor = new UtteranceTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            processor.process("u1", "In one experiment", false);
            expect(processor.process("u2", "this scientist shined", false).position).to.equal(5);
        });
        it("Retracts an interim overshoot when the interim is revised", () => {
            const processor: UtteranceTranscriptProcessor = new UtteranceTranscriptProcessor(
                new TranscriptAligner(repeatedPhraseWords)
            );

            expect(processor.process("u1", "alpha beta gamma", true).position).to.equal(2);

            // A speculative interim runs ahead to the second "beta gamma"...
            expect(processor.process("u2", "delta beta gamma", false).position).to.equal(5);

            // ...then the recognizer revises it back to just "delta"; the overshoot is undone
            expect(processor.process("u2", "delta", false).position).to.equal(3);
        });
        it("A revised word is reprocessed", () => {
            const processor: UtteranceTranscriptProcessor = new UtteranceTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            // The recognizer first hears "this scientist cried", then corrects it to "shined"
            expect(processor.process("u1", "In one experiment this scientist cried", false).position).to.equal(4);
            expect(processor.process("u1", "In one experiment this scientist shined", false).position).to.equal(5);
        });
        it("Follows a long utterance that grows word by word while earlier words get reformatted", () => {
            // Safari reports each utterance as one growing, formatted transcript, and it revises earlier words as
            // it hears more. Spelling out numbers already makes "ten" and "10" the same token, so revise a word
            // into a different one to force the transcript after it to be reprocessed.
            const text: string[] = [];
            for (let sentence = 0; sentence < 6; sentence++) {
                text.push(
                    ..."For ten points name this author of a novel about a whale and its obsessive captain".split(" "),
                    `clue${sentence}`
                );
            }

            const processor: UtteranceTranscriptProcessor = new UtteranceTranscriptProcessor(
                new TranscriptAligner(text, 0)
            );
            const startTime: number = Date.now();
            let position = -1;
            for (let i = 0; i < text.length; i++) {
                const heard: string[] = text.slice(0, i + 1);
                if (i % 7 === 0) {
                    // Revise an early word, which changes the transcript near its start
                    heard[1] = "tin";
                }

                position = processor.process("u1", heard.join(" "), false, i * 300).position;
            }

            expect(position).to.equal(text.length - 1);
            expect(Date.now() - startTime).to.be.below(2000);
        });
        it("Revisions never retract past a finalized utterance", () => {
            const processor: UtteranceTranscriptProcessor = new UtteranceTranscriptProcessor(
                new TranscriptAligner(questionWords)
            );

            expect(processor.process("u1", "In one experiment", true).position).to.equal(2);
            expect(processor.process("u2", "this scientist", false).position).to.equal(4);
            expect(processor.process("u2", "this", false).position).to.equal(3);
            expect(processor.process("u2", "", false).position).to.equal(2);
        });
    });
});
