import { assert, expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import { Cycle } from "src/state/Cycle";
import { IBuzzMarker } from "src/state/IBuzzMarker";
import { Player } from "src/state/TeamState";
import { IBonusAnswerEvent, ITossupAnswerEvent } from "src/state/Events";

function addDefaultCorrectBuzz(cycle: Cycle): void {
    const marker: IBuzzMarker = {
        player: new Player("Alice", "Alpha", /* isStarter */ true),
        position: 10,
        points: 10,
    };
    cycle.addCorrectBuzz(marker, 2, GameFormats.UndefinedGameFormat, 0, 3);
}

function verifyDefaultBonusAnswer(bonusAnswer: IBonusAnswerEvent, bonusIndex: number): void {
    // Verify that the bonus answer is set up correctly, and that none of the parts share the same reference
    expect(bonusAnswer.bonusIndex).to.equal(bonusIndex);

    expect(bonusAnswer.parts.length).to.equal(3);
    expect(bonusAnswer.parts.map((part) => part.points)).to.deep.equal([0, 0, 0]);
    expect(bonusAnswer.parts.map((part) => part.teamName)).to.deep.equal(["", "", ""]);
    expect(bonusAnswer.parts[0]).to.not.equal(bonusAnswer.parts[1]);
    expect(bonusAnswer.parts[0]).to.not.equal(bonusAnswer.parts[2]);
    expect(bonusAnswer.parts[1]).to.not.equal(bonusAnswer.parts[2]);
}

describe("CycleTests", () => {
    describe("addCorrectBuzz", () => {
        it("Adds buzz", () => {
            const cycle: Cycle = new Cycle();

            const marker: IBuzzMarker = {
                player: new Player("Alice", "Alpha", /* isStarter */ true),
                position: 10,
                points: 10,
            };
            cycle.addCorrectBuzz(marker, 2, GameFormats.UndefinedGameFormat, 1, 3);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(2);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);

            if (cycle.bonusAnswer == undefined) {
                assert.fail("bonus answer was null");
            }

            verifyDefaultBonusAnswer(cycle.bonusAnswer, 1);
        });
        it("Correct buzz removes wrong buzz", () => {
            const cycle: Cycle = new Cycle();
            const player: Player = new Player("Alice", "Alpha", /* isStarter */ true);

            const negMarker: IBuzzMarker = {
                player,
                position: 15,
                points: -5,
            };
            cycle.addWrongBuzz(negMarker, 2, GameFormats.UndefinedGameFormat);

            const marker: IBuzzMarker = {
                player,
                position: 10,
                points: 10,
            };
            cycle.addCorrectBuzz(marker, 2, GameFormats.UndefinedGameFormat, 1, 3);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(2);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);

            if (cycle.bonusAnswer == undefined) {
                assert.fail("bonus answer was null");
            }

            verifyDefaultBonusAnswer(cycle.bonusAnswer, 1);

            expect(cycle.wrongBuzzes).to.exist;
            expect(cycle.wrongBuzzes?.length).to.equal(0);
        });
        it("Correct buzz changes wrong buzz and other buzz to neg", () => {
            const cycle: Cycle = new Cycle();
            const player: Player = new Player("Alice", "Alpha", /* isStarter */ true);
            const otherPlayer: Player = new Player("Bob", "Beta", /* isStarter */ true);

            const negMarker: IBuzzMarker = {
                player,
                position: 5,
                points: -5,
                isLastWord: false,
            };
            cycle.addWrongBuzz(negMarker, 1, GameFormats.UndefinedGameFormat);
            const otherNegMarker: IBuzzMarker = {
                player: otherPlayer,
                position: 10,
                points: 0,
                isLastWord: false,
            };
            cycle.addWrongBuzz(otherNegMarker, 1, GameFormats.UndefinedGameFormat);

            const marker: IBuzzMarker = {
                player,
                position: 15,
                points: 10,
                isLastWord: false,
            };
            cycle.addCorrectBuzz(marker, 1, GameFormats.UndefinedGameFormat, 0, 3);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(1);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);

            if (cycle.bonusAnswer == undefined) {
                assert.fail("bonus answer was null");
            }

            verifyDefaultBonusAnswer(cycle.bonusAnswer, 0);

            if (cycle.wrongBuzzes == undefined) {
                assert.fail("wrongBuzzes shouldn't be undefined");
            }

            expect(cycle.wrongBuzzes.length).to.equal(1);

            const wrongBuzz: ITossupAnswerEvent = cycle.wrongBuzzes[0];
            expect(wrongBuzz.marker.player).to.equal(otherPlayer);
            expect(wrongBuzz.marker.position).to.equal(otherNegMarker.position);
            expect(wrongBuzz.marker.points).to.equal(GameFormats.UndefinedGameFormat.negValue);
        });
        it("Adds buzz with non-3-part bonus", () => {
            const cycle: Cycle = new Cycle();

            const marker: IBuzzMarker = {
                player: new Player("Alice", "Alpha", /* isStarter */ true),
                position: 10,
                points: 10,
            };
            cycle.addCorrectBuzz(marker, 2, GameFormats.UndefinedGameFormat, 1, 2);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(2);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);

            if (cycle.bonusAnswer == undefined) {
                assert.fail("bonus answer was null");
            }

            expect(cycle.bonusAnswer.parts.length).to.equal(2);
            expect(cycle.bonusAnswer.parts.map((part) => part.points)).to.deep.equal([0, 0]);
            expect(cycle.bonusAnswer.parts.map((part) => part.teamName)).to.deep.equal(["", ""]);
            expect(cycle.bonusAnswer.parts[0]).to.not.equal(cycle.bonusAnswer.parts[1]);
        });
    });
    describe("setBonusPartAnswer", () => {
        it("Scoring bonus with no correct buzz does nothing", () => {
            const cycle: Cycle = new Cycle();
            cycle.setBonusPartAnswer(0, "A", 10);
            expect(cycle.bonusAnswer).to.not.exist;
        });
        it("Set first part", () => {
            const cycle: Cycle = new Cycle();

            addDefaultCorrectBuzz(cycle);
            cycle.setBonusPartAnswer(0, "Alpha", 10);
            if (cycle.bonusAnswer == undefined) {
                assert.fail("bonus answer was null");
            }

            expect(cycle.bonusAnswer.parts[0]).to.deep.equal({ teamName: "Alpha", points: 10 });
            expect(cycle.bonusAnswer.parts.slice(1).map((part) => part.teamName)).to.deep.equal(["", ""]);
            expect(cycle.bonusAnswer.parts.slice(1).map((part) => part.points)).to.deep.equal([0, 0]);
        });
        it("Bonus with bouncebacks has different teams", () => {
            const cycle: Cycle = new Cycle();

            addDefaultCorrectBuzz(cycle);
            cycle.setBonusPartAnswer(0, "Alpha", 10);
            cycle.setBonusPartAnswer(2, "Beta", 10);
            if (cycle.bonusAnswer == undefined) {
                assert.fail("bonus answer was null");
            }

            expect(cycle.bonusAnswer.parts).to.deep.equal([
                { teamName: "Alpha", points: 10 },
                { teamName: "", points: 0 },
                { teamName: "Beta", points: 10 },
            ]);
        });
        it("Bonus with different point values", () => {
            const cycle: Cycle = new Cycle();

            addDefaultCorrectBuzz(cycle);
            cycle.setBonusPartAnswer(1, "Alpha", 10);
            cycle.setBonusPartAnswer(2, "Alpha", 15);
            if (cycle.bonusAnswer == undefined) {
                assert.fail("bonus answer was null");
            }

            expect(cycle.bonusAnswer.parts).to.deep.equal([
                { teamName: "", points: 0 },
                { teamName: "Alpha", points: 10 },
                { teamName: "Alpha", points: 15 },
            ]);
        });
    });
});
