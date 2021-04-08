import { assert, expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import { Cycle } from "src/state/Cycle";
import { IBuzzMarker } from "src/state/IBuzzMarker";
import { Player } from "src/state/TeamState";
import { ITossupAnswerEvent } from "src/state/Events";

describe("CycleTests", () => {
    describe("addCorrectBuzz", () => {
        it("Adds buzz", () => {
            const cycle: Cycle = new Cycle();

            const marker: IBuzzMarker = {
                player: new Player("Alice", "Alpha", /* isStarter */ true),
                position: 10,
                points: 10,
            };
            cycle.addCorrectBuzz(marker, 2, GameFormats.UndefinedGameFormat, 1);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(2);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);

            expect(cycle.bonusAnswer).to.exist;
            expect(cycle.bonusAnswer?.bonusIndex).to.equal(1);
            expect(cycle.bonusAnswer?.correctParts.length).to.equal(0);
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
            cycle.addCorrectBuzz(marker, 2, GameFormats.UndefinedGameFormat, 1);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(2);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);

            expect(cycle.bonusAnswer).to.exist;
            expect(cycle.bonusAnswer?.bonusIndex).to.equal(1);
            expect(cycle.bonusAnswer?.correctParts.length).to.equal(0);

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
            cycle.addCorrectBuzz(marker, 1, GameFormats.UndefinedGameFormat, 0);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(1);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);

            expect(cycle.bonusAnswer).to.exist;
            expect(cycle.bonusAnswer?.bonusIndex).to.equal(0);
            expect(cycle.bonusAnswer?.correctParts.length).to.equal(0);

            if (cycle.wrongBuzzes == undefined) {
                assert.fail("wrongBuzzes shouldn't be undefined");
            }

            expect(cycle.wrongBuzzes.length).to.equal(1);

            const wrongBuzz: ITossupAnswerEvent = cycle.wrongBuzzes[0];
            expect(wrongBuzz.marker.player).to.equal(otherPlayer);
            expect(wrongBuzz.marker.position).to.equal(otherNegMarker.position);
            expect(wrongBuzz.marker.points).to.equal(GameFormats.UndefinedGameFormat.negValue);
        });
    });
});
