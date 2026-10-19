import { expect } from "chai";

import * as RoundTiming from "src/scorecard/RoundTiming";
import { buildRoundScorecard, IRoundScorecard, sentenceStarts } from "src/scorecard/RoundScorecard";
import { watchRoundTiming } from "src/scorecard/watchRoundTiming";
import { AppState } from "src/state/AppState";
import { IBuzzPointPlacement } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import * as GameFormats from "src/state/GameFormats";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";

let clock = 0;
const at = (ms: number): void => {
    clock = ms;
};

// Reads `words` from word `from` to `to` (inclusive) at one word every `msPerWord`, starting at `start`
function read(kind: "tossup" | "bonus", from: number, to: number, start: number, msPerWord: number): number {
    for (let word = from; word <= to; word++) {
        at(start + (word - from) * msPerWord);
        RoundTiming.recordReaderPosition(kind, word);
    }

    return clock;
}

const tossupWords: string[] = (
    "This composer wrote a famous mass. He served in Leipzig for decades. " +
    "J. S. Bach is the answer here? For ten points, name this composer."
).split(" ");

describe("RoundScorecardTests", () => {
    beforeEach(() => {
        clock = 0;
        RoundTiming.setRoundTimingClock(() => clock);
        RoundTiming.configureRoundTiming(true, `test-${Math.random()}`);
    });

    afterEach(() => {
        RoundTiming.configureRoundTiming(false, undefined);
    });

    it("splits sentences, skipping initials and abbreviations", () => {
        expect(sentenceStarts(tossupWords)).to.deep.equal([0, 6, 12, 19]);
        expect(sentenceStarts("Visit St. Louis. Then go home.".split(" "))).to.deep.equal([0, 3]);
    });

    it("records nothing until turned on with a key", () => {
        RoundTiming.configureRoundTiming(false, "off");
        RoundTiming.recordQuestionShown(0, 1);
        expect(RoundTiming.getRoundTiming()).to.be.undefined;
        RoundTiming.configureRoundTiming(true, undefined);
        expect(RoundTiming.isRoundTimingActive()).to.be.false;
    });

    it("times questions, answers, bonus parts and sentences", () => {
        // Question 1: read at 300 ms a word, buzzed after the third sentence starts, ruled correct 2 s later
        at(1000);
        RoundTiming.recordQuestionShown(0, 1);
        RoundTiming.recordTossupWords(tossupWords);
        read("tossup", 0, 14, 3000, 300); // last word at 7200
        at(7400);
        RoundTiming.recordBuzzRecognized();
        at(8600);
        RoundTiming.recordRulingHeard();
        at(9400);
        RoundTiming.recordRuling(true, 15);

        // Its bonus: leadin of 4 words, parts of 5 words each
        RoundTiming.recordBonusWords(4, [5, 5, 5]);
        read("bonus", 0, 8, 10000, 300); // part 1 ends (word 8) at 12400
        read("bonus", 9, 13, 16400, 300); // part 2 starts 4 s later; ends at 17600
        read("bonus", 14, 18, 25600, 300); // part 3 starts 8 s later; ends at 26800
        at(29800);
        RoundTiming.recordBonusPartScored(2); // last part scored 3 s after it was read

        // Question 2: shown at 31 s, first word heard at 35.8 s, dead tossup
        at(31000);
        RoundTiming.recordQuestionShown(1, 2);
        RoundTiming.recordTossupWords(tossupWords);
        read("tossup", 0, 23, 35800, 300);

        const card: IRoundScorecard = buildRoundScorecard(RoundTiming.getRoundTiming()!);
        expect(card.questionsShown).to.equal(2);
        // From the last part scored (29.8 s) to question 2's first word (35.8 s)
        expect(card.betweenQuestions.count).to.equal(1);
        expect(card.betweenQuestions.medianMs).to.equal(6000);
        expect(card.tossupAnswerWait.count).to.equal(1);
        expect(card.tossupAnswerWait.medianMs).to.equal(2000);
        expect(card.rulingHeardToEntered.medianMs).to.equal(800);
        expect(card.bonusPartWait.count).to.equal(3);
        expect(card.bonusPartWait.longest.map((item) => item.ms)).to.deep.equal([8000]);
        expect(card.bonusPartWait.overReference).to.equal(1);
        expect(card.bonusPartWait.totalMs).to.equal(4000 + 8000 + 3000);

        const reading = card.reading!;
        expect(reading).to.not.be.undefined;
        expect(reading.coverage).to.equal(1);
        expect(Math.round(reading.wordsPerMinute!)).to.equal(200);
        // Question 1 reached sentences 1-3 before the buzz (2 timed), question 2 all four (3 timed)
        expect(reading.sentenceSeconds.count).to.equal(5);
        expect(reading.sentenceSeconds.medianMs).to.equal(1800);
        expect(reading.longPauses).to.be.empty;
        expect(reading.keptReading).to.be.empty;
        // Saved on word 15; read-along had the reader on word 14
        expect(reading.buzzNudges).to.equal(1);
    });

    it("notices pauses and reading on after a buzz", () => {
        at(0);
        RoundTiming.recordQuestionShown(0, 1);
        RoundTiming.recordTossupWords(tossupWords);
        read("tossup", 0, 5, 1000, 300);
        read("tossup", 6, 10, 5000, 300); // a 2.5 s stall after "mass."
        at(6300);
        RoundTiming.recordBuzzRecognized();
        read("tossup", 11, 16, 7600, 200); // still reading 1.3 s after the buzz
        at(9000);
        RoundTiming.recordRuling(false, 10);
        for (let cycle = 1; cycle < 5; cycle++) {
            at(10000 * (cycle + 1));
            RoundTiming.recordQuestionShown(cycle, cycle + 1);
            RoundTiming.recordTossupWords(tossupWords);
            read("tossup", 0, 23, clock + 1000, 300);
        }

        const reading = buildRoundScorecard(RoundTiming.getRoundTiming()!).reading!;
        expect(reading.longPauses.map((pause) => [pause.question, pause.ms])).to.deep.equal([[1, 2500]]);
        expect(reading.longPauses[0].detail).to.contain("mass.");
        expect(reading.keptReading.map((item) => item.question)).to.deep.equal([1]);
    });

    it("hides reading numbers when read-along heard too little", () => {
        for (let cycle = 0; cycle < 4; cycle++) {
            at(cycle * 20000);
            RoundTiming.recordQuestionShown(cycle, cycle + 1);
            RoundTiming.recordTossupWords(tossupWords);
            if (cycle === 0) {
                read("tossup", 0, 23, clock + 1000, 300);
            }
        }

        const card: IRoundScorecard = buildRoundScorecard(RoundTiming.getRoundTiming()!);
        expect(card.reading).to.be.undefined;
        expect(card.readingHiddenBecause).to.contain("1 of 4");
        // Without read-along, time between questions runs to the next question being shown
        expect(card.betweenQuestions.count).to.equal(3);
    });
});

describe("watchRoundTimingTests", () => {
    it("records the question on screen, rulings, bonus parts and Space", () => {
        let now = 1000;
        RoundTiming.setRoundTimingClock(() => now);
        const key = `watch-${Math.random()}`;
        RoundTiming.configureRoundTiming(true, key);

        const appState: AppState = new AppState();
        // Started before the game loads, as on the page
        const dispose = watchRoundTiming(appState);
        appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);
        const packet: PacketState = new PacketState();
        packet.setTossups([new Tossup("First question here.", "A"), new Tossup("Second question here.", "B")]);
        packet.setBonuses([
            new Bonus("Leadin.", [
                { question: "One?", answer: "a", value: 10 },
                { question: "Two?", answer: "b", value: 10 },
            ]),
            new Bonus("Leadin two.", []),
        ]);
        appState.game.loadPacket(packet);
        appState.uiState.toggleRoundScorecard();

        try {
            RoundTiming.recordQuestionShown(0, 1);
            now = 2000;
            appState.uiState.startBuzzPointPlacement({ startTime: 2000, startLivePosition: -1 } as IBuzzPointPlacement);
            now = 3000;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addWrongBuzz({ player: appState.game.players[1], points: -5, position: 1, isLastWord: false }, 0, GameFormats.ACFGameFormat);
            now = 4000;
            cycle.addCorrectBuzz({ player: appState.game.players[0], points: 10, position: 2, isLastWord: false }, 0, GameFormats.ACFGameFormat, 0, 2);
            now = 5000;
            cycle.setBonusPartAnswer(1, "Alpha", 10);
            now = 6000;
            appState.uiState.setCycleIndex(1);

            const log = RoundTiming.getRoundTiming(key)!;
            expect(log.questions[0].recognized).to.deep.equal([2000]);
            const q = log.questions[0];
            expect(q.rulings).to.deep.equal([
                { at: 3000, correct: false, position: 1 },
                { at: 4000, correct: true, position: 2 },
            ]);
            expect(q.bonus?.scored[1]).to.equal(5000);
            expect(log.questions[1]?.shownAt).to.equal(6000);
        } finally {
            dispose();
            RoundTiming.configureRoundTiming(false, undefined);
        }
    });
});
