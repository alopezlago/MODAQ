import { assert, expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import { Cycle } from "src/state/Cycle";
import { IBuzzMarker } from "src/state/IBuzzMarker";
import { IPlayer, Player } from "src/state/TeamState";
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
        it("Correct buzz change for same team keeps bonus", () => {
            const cycle: Cycle = new Cycle();
            const player: Player = new Player("Alice", "Alpha", /* isStarter */ true);
            const otherPlayer: Player = new Player("Anna", "Alpha", /* isStarter */ true);

            const marker: IBuzzMarker = {
                player,
                position: 10,
                points: 10,
            };
            cycle.addCorrectBuzz(marker, 0, GameFormats.UndefinedGameFormat, 0, 3);
            cycle.setBonusPartAnswer(1, "Alpha", 10);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(0);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);

            if (cycle.bonusAnswer == undefined) {
                assert.fail("bonus answer was null");
            }

            expect(cycle.bonusAnswer.parts.map((part) => part.points)).to.deep.equal([0, 10, 0]);

            const newMarker: IBuzzMarker = {
                player: otherPlayer,
                position: 11,
                points: 10,
            };
            cycle.addCorrectBuzz(newMarker, 0, GameFormats.UndefinedGameFormat, 0, 3);

            if (cycle.bonusAnswer == undefined) {
                assert.fail("bonus answer was nul after fixing the buzz");
            }

            expect(cycle.bonusAnswer.parts.map((part) => part.points)).to.deep.equal([0, 10, 0]);
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
    describe("Update handler", () => {
        it("Update handler called on updates", () => {
            const cycle: Cycle = new Cycle();

            let updated = false;
            cycle.setUpdateHandler(() => {
                updated = true;
            });

            cycle.addThrownOutTossup(0);
            expect(updated).to.be.true;
            updated = false;

            cycle.addWrongBuzz(
                { player: new Player("Bob", "Beta", /* isStarter */ true), position: 5, points: -5 },
                1,
                GameFormats.UndefinedGameFormat
            );
            expect(updated).to.be.true;
            updated = false;

            cycle.addTossupProtest("Beta", 1, 5, "Wrong thing", "Reason");
            expect(updated).to.be.true;
            updated = false;

            addDefaultCorrectBuzz(cycle);
            expect(updated).to.be.true;
            updated = false;

            cycle.addThrownOutBonus(0);
            expect(updated).to.be.true;
            updated = false;

            cycle.setBonusPartAnswer(0, "Alpha", 10);
            expect(updated).to.be.true;
            updated = false;

            cycle.addBonusProtest(1, 1, "Wrong", "Reason", "Alpha");
            expect(updated).to.be.true;
            updated = false;

            cycle.removeBonusProtest(1);
            expect(updated).to.be.true;
            updated = false;

            const newPlayer: IPlayer = { name: "Alvaro", teamName: "Alpha", isStarter: false };
            cycle.addPlayerJoins(newPlayer);
            expect(updated).to.be.true;
            updated = false;

            cycle.addSwapSubstitution(newPlayer, { name: "Alice", teamName: "Alpha", isStarter: true });
            expect(updated).to.be.true;
            updated = false;

            cycle.addPlayerLeaves({ name: "Anna", teamName: "Alpha", isStarter: false });
            expect(updated).to.be.true;
            updated = false;

            if (cycle.playerLeaves == undefined) {
                assert.fail("There should be a player leaves event");
            }
            cycle.removePlayerLeaves(cycle.playerLeaves[0]);
            expect(updated).to.be.true;
            updated = false;

            if (cycle.subs == undefined) {
                assert.fail("There should be a substitution event");
            }
            cycle.removeSubstitution(cycle.subs[0]);
            expect(updated).to.be.true;
            updated = false;

            if (cycle.playerJoins == undefined) {
                assert.fail("There should be a player joins event");
            }
            cycle.removePlayerJoins(cycle.playerJoins[0]);
            expect(updated).to.be.true;
            updated = false;

            cycle.removeThrownOutBonus(0);
            expect(updated).to.be.true;
            updated = false;

            cycle.removeCorrectBuzz();
            expect(updated).to.be.true;
            updated = false;

            cycle.removeTossupProtest("Beta");
            expect(updated).to.be.true;
            updated = false;

            cycle.removeWrongBuzz(new Player("Bob", "Beta", /* isStarter */ true), GameFormats.UndefinedGameFormat);
            expect(updated).to.be.true;
            updated = false;

            cycle.removeThrownOutTossup(0);
            expect(updated).to.be.true;
            updated = false;
        });
        it("Update handler can be cleared", () => {
            const cycle: Cycle = new Cycle();

            let updated = false;
            cycle.setUpdateHandler(() => {
                updated = true;
            });

            const newPlayer: IPlayer = { name: "Alvaro", teamName: "Alpha", isStarter: false };
            cycle.addPlayerJoins(newPlayer);
            expect(updated).to.be.true;
            updated = false;

            cycle.setUpdateHandler(() => {
                return;
            });
            cycle.addPlayerJoins(newPlayer);
            expect(updated).to.be.false;
        });
    });
    describe("removeNewPlayerEvents", () => {
        it("Remove new player's correct buzz and bonus events", () => {
            const newPlayer: Player = new Player("Newton", "Alpha", false);
            const existingPlayer: Player = new Player("Zach", "Zeta", true);

            const cycle: Cycle = new Cycle();
            cycle.addPlayerJoins(newPlayer);
            cycle.addWrongBuzz(
                { player: existingPlayer, points: -5, position: 10 },
                1,
                GameFormats.UndefinedGameFormat
            );

            cycle.addCorrectBuzz(
                { player: newPlayer, points: 10, position: 20 },
                1,
                GameFormats.UndefinedGameFormat,
                0,
                3
            );
            cycle.addBonusProtest(0, 0, "Answer", "Reason", newPlayer.teamName);
            cycle.setBonusPartAnswer(1, newPlayer.teamName, 10);
            cycle.setBonusPartAnswer(2, newPlayer.teamName, 10);

            // Verify we have the parts and protests and buzzes
            if (cycle.playerJoins == undefined) {
                assert.fail("There should be a player joins event");
            }

            expect(cycle.playerJoins[0].inPlayer).to.equal(newPlayer);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.marker.player).to.equal(newPlayer);

            if (cycle.bonusProtests == undefined) {
                assert.fail("bonus protest should exist before we remove the player");
            }

            expect(cycle.bonusProtests[0].teamName).to.equal(newPlayer.teamName);
            expect(cycle.bonusAnswer).to.exist;
            expect(cycle.bonusAnswer?.receivingTeamName).to.equal(newPlayer.teamName);
            expect(cycle.bonusAnswer?.parts[1]).to.exist;
            expect(cycle.bonusAnswer?.parts[2]).to.exist;

            cycle.removeNewPlayerEvents(newPlayer);

            // Verify that the parts are gone
            expect(cycle.playerJoins.length).to.equal(0);
            expect(cycle.correctBuzz).to.not.exist;
            expect(cycle.bonusAnswer).to.not.exist;
            expect(cycle.bonusProtests).to.not.exist;
            expect(cycle.wrongBuzzes?.length).to.equal(1);
        });
        it("Remove new player's wrong buzz and protest", () => {
            const newPlayer: Player = new Player("Newton", "Alpha", false);
            const existingPlayer: Player = new Player("Zach", "Zeta", true);

            const cycle: Cycle = new Cycle();
            cycle.addPlayerJoins(newPlayer);
            cycle.addWrongBuzz({ player: newPlayer, points: -5, position: 10 }, 1, GameFormats.UndefinedGameFormat);
            cycle.addTossupProtest(newPlayer.teamName, 1, 10, "Answer", "Reason");

            cycle.addCorrectBuzz(
                { player: existingPlayer, points: 10, position: 20 },
                1,
                GameFormats.UndefinedGameFormat,
                0,
                3
            );
            cycle.addBonusProtest(0, 0, "Answer", "Reason", existingPlayer.teamName);
            cycle.setBonusPartAnswer(1, existingPlayer.teamName, 10);

            // Verify we have the parts and protests and buzzes
            if (cycle.playerJoins == undefined) {
                assert.fail("There should be a player joins event");
            }

            expect(cycle.playerJoins[0].inPlayer).to.equal(newPlayer);

            if (cycle.wrongBuzzes == undefined) {
                assert.fail("There should be at least one wrong buzz");
            }

            expect(cycle.wrongBuzzes[0].marker.player).to.equal(newPlayer);

            if (cycle.tossupProtests == undefined) {
                assert.fail("bonus protest should exist before we remove the player");
            }

            expect(cycle.tossupProtests[0].teamName).to.equal(newPlayer.teamName);

            cycle.removeNewPlayerEvents(newPlayer);

            // Verify that the parts are gone
            expect(cycle.playerJoins.length).to.equal(0);
            expect(cycle.wrongBuzzes?.length).to.equal(0);
            expect(cycle.tossupProtests.length).to.equal(0);

            // Other player events shouldn't be changed
            expect(cycle.correctBuzz).to.exist;
            expect(cycle.bonusAnswer).to.exist;
        });
    });
});
