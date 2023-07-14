import { expect } from "chai";

import { Cycle } from "src/state/Cycle";
import { Player } from "src/state/TeamState";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup, Bonus } from "src/state/PacketState";

const firstTeamPlayer: Player = new Player("Alice", "A", /* isStarter */ true);
const secondTeamPlayer: Player = new Player("Bob", "B", /* isStarter */ true);
const players: Player[] = [firstTeamPlayer, secondTeamPlayer];

const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([
    new Tossup("first q", "first a"),
    new Tossup("second q", "second a"),
    new Tossup("third q", "third a"),
    new Tossup("fourth q", "fourth a"),
]);
defaultPacket.setBonuses([
    new Bonus("first leadin", [{ question: "first q", answer: "first a", value: 10 }]),
    new Bonus("second leadin", [{ question: "second q", answer: "second a", value: 10 }]),
    new Bonus("third leadin", [{ question: "third q", answer: "third a", value: 10 }]),
    new Bonus("fourth leadin", [{ question: "fourth q", answer: "fourth a", value: 10 }]),
]);

describe("GameStateTests", () => {
    describe("getBonusIndex", () => {
        it("No buzzes, same bonus", () => {
            const game: GameState = createDefaultGame();

            for (let i = 0; i < game.cycles.length; i++) {
                expect(game.getBonusIndex(i)).to.equal(0);
            }
        });
        it("No buzzes, paired bonus", () => {
            const game: GameState = createDefaultGame(/* pairTossupsBonuses */ true);

            for (let i = 0; i < game.cycles.length; i++) {
                expect(game.getBonusIndex(i)).to.equal(i);
            }
        });
        it("No correct buzzes, same bonus", () => {
            const game: GameState = createDefaultGame();
            const buzzCycleIndex = 1;
            game.cycles[buzzCycleIndex].addWrongBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: -5,
                },
                0,
                game.gameFormat
            );

            for (let i = 0; i < game.cycles.length; i++) {
                expect(game.getBonusIndex(i)).to.equal(0);
            }
        });
        it("No correct buzzes, paired bonus", () => {
            const game: GameState = createDefaultGame(/* pairTossupsBonuses */ true);
            const buzzCycleIndex = 1;
            game.cycles[buzzCycleIndex].addWrongBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: -5,
                },
                0,
                game.gameFormat
            );

            for (let i = 0; i < game.cycles.length; i++) {
                expect(game.getBonusIndex(i)).to.equal(i);
            }
        });
        it("Correct buzz changes next cycle's bonus", () => {
            const game: GameState = createDefaultGame();

            const buzzCycleIndex = 1;
            game.cycles[buzzCycleIndex].addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );

            expect(game.getBonusIndex(0)).to.equal(0);
            expect(game.getBonusIndex(buzzCycleIndex)).to.equal(0);
            expect(game.getBonusIndex(2)).to.equal(1);
        });
        it("Correct buzz with paired bonuses changes nothing", () => {
            const game: GameState = createDefaultGame(/* pairTossupsBonuses */ true);

            const buzzCycleIndex = 1;
            game.cycles[buzzCycleIndex].addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );

            for (let i = 0; i < game.cycles.length; i++) {
                expect(game.getBonusIndex(i)).to.equal(i);
            }
        });
        it("Thrown out bonus changes this cycle's bonus", () => {
            const game: GameState = createDefaultGame();

            const buzzCycleIndex = 1;
            game.cycles[buzzCycleIndex].addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );
            game.cycles[buzzCycleIndex].addThrownOutBonus(0);

            expect(game.getBonusIndex(0)).to.equal(0);
            expect(game.getBonusIndex(buzzCycleIndex)).to.equal(1);
            expect(game.getBonusIndex(2)).to.equal(2);
        });
        it("Thrown out bonuses changes this cycle's bonus", () => {
            const game: GameState = createDefaultGame();

            const buzzCycleIndex = 1;
            const cycle: Cycle = game.cycles[buzzCycleIndex];
            cycle.addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );
            cycle.addThrownOutBonus(0);
            cycle.addThrownOutBonus(1);

            expect(game.getBonusIndex(0)).to.equal(0);
            expect(game.getBonusIndex(buzzCycleIndex)).to.equal(2);
            expect(game.getBonusIndex(2)).to.equal(3);
        });
        it("Thrown out bonus changes paired cycle's bonus", () => {
            const game: GameState = createDefaultGame(/* pairTossupsBonuses */ true);

            const buzzCycleIndex = 1;
            game.cycles[buzzCycleIndex].addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );
            game.cycles[buzzCycleIndex].addThrownOutBonus(1);

            expect(game.getBonusIndex(0)).to.equal(0);
            for (let i = 1; i < game.cycles.length - 1; i++) {
                expect(game.getBonusIndex(i)).to.equal(i + 1);
            }

            // Last cycle doesn't have a bonus
            expect(game.getBonusIndex(game.cycles.length - 1)).to.equal(-1);
        });
        it("Thrown out bonuses changes this cycle's bonus", () => {
            const game: GameState = createDefaultGame();

            const buzzCycleIndex = 1;
            const cycle: Cycle = game.cycles[buzzCycleIndex];
            cycle.addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );
            cycle.addThrownOutBonus(0);
            cycle.addThrownOutBonus(1);

            expect(game.getBonusIndex(0)).to.equal(0);
            expect(game.getBonusIndex(buzzCycleIndex)).to.equal(2);
            expect(game.getBonusIndex(2)).to.equal(3);
        });
        it("Thrown out bonuses changes paired cycle's bonus", () => {
            const game: GameState = createDefaultGame(/* pairTossupsBonuses */ true);

            const buzzCycleIndex = 1;
            const cycle: Cycle = game.cycles[buzzCycleIndex];
            cycle.addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );
            cycle.addThrownOutBonus(0);
            cycle.addThrownOutBonus(1);

            expect(game.getBonusIndex(0)).to.equal(0);
            for (let i = 1; i < game.cycles.length - 2; i++) {
                expect(game.getBonusIndex(i)).to.equal(i + 2);
            }

            // Second to last cycle doesn't have a bonus index
            expect(game.getBonusIndex(game.cycles.length - 2)).to.equal(-1);
        });
        it("Correct buzzes changes multiple cycle's bonus", () => {
            const game: GameState = createDefaultGame();

            const buzzCycleIndex = 0;
            const secondBuzzCycleIndex = 1;
            game.cycles[buzzCycleIndex].addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );

            game.cycles[secondBuzzCycleIndex].addCorrectBuzz(
                {
                    player: secondTeamPlayer,
                    position: 2,
                    points: 10,
                },
                1,
                game.gameFormat,
                1,
                defaultPacket.bonuses[1].parts.length
            );

            expect(game.getBonusIndex(buzzCycleIndex)).to.equal(0);
            expect(game.getBonusIndex(secondBuzzCycleIndex)).to.equal(1);
            expect(game.getBonusIndex(secondBuzzCycleIndex + 1)).to.equal(2);
        });
        it("Not enough bonuses", () => {
            const game: GameState = createDefaultGame();

            const buzzCycleIndex = 0;
            const buzzCycle: Cycle = game.cycles[buzzCycleIndex];
            buzzCycle.addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );

            // Throw out all but the last two bonuses. The next cycle will use the last bonus, then we can verify that
            // throwing it out returns -1 for getBonusIndex
            for (let i = 0; i < game.packet.bonuses.length - 2; i++) {
                buzzCycle.addThrownOutBonus(i);
            }

            const nextBuzzCycleIndex = 1;
            const nextBuzzCycle: Cycle = game.cycles[nextBuzzCycleIndex];
            nextBuzzCycle.addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 2,
                    points: 10,
                },
                1,
                game.gameFormat,
                game.packet.bonuses.length - 1,
                defaultPacket.bonuses[game.packet.bonuses.length - 1].parts.length
            );

            expect(game.getBonusIndex(buzzCycleIndex)).to.equal(game.packet.bonuses.length - 2);
            expect(game.getBonusIndex(nextBuzzCycleIndex)).to.equal(game.packet.bonuses.length - 1);

            nextBuzzCycle.addThrownOutBonus(game.packet.bonuses.length - 1);
            expect(game.getBonusIndex(nextBuzzCycleIndex)).to.equal(-1);
            expect(game.getBonusIndex(nextBuzzCycleIndex + 1)).to.equal(-1);
        });
        it("Not enough bonuses with paired bonuses", () => {
            const game: GameState = createDefaultGame(/* pairTossupsBonuses */ true);

            const buzzCycleIndex = 0;
            const buzzCycle: Cycle = game.cycles[buzzCycleIndex];
            buzzCycle.addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 1,
                    points: 10,
                },
                0,
                game.gameFormat,
                0,
                defaultPacket.bonuses[0].parts.length
            );

            // Throw out all but the last two bonuses. The next cycle will use the last bonus, then we can verify that
            // throwing it out returns -1 for getBonusIndex
            for (let i = 0; i < game.packet.bonuses.length - 2; i++) {
                buzzCycle.addThrownOutBonus(i);
            }

            const nextBuzzCycleIndex = 1;
            const nextBuzzCycle: Cycle = game.cycles[nextBuzzCycleIndex];
            nextBuzzCycle.addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: 2,
                    points: 10,
                },
                1,
                game.gameFormat,
                game.packet.bonuses.length - 1,
                defaultPacket.bonuses[game.packet.bonuses.length - 1].parts.length
            );

            expect(game.getBonusIndex(buzzCycleIndex)).to.equal(game.packet.bonuses.length - 2);
            expect(game.getBonusIndex(nextBuzzCycleIndex)).to.equal(game.packet.bonuses.length - 1);

            nextBuzzCycle.addThrownOutBonus(game.packet.bonuses.length - 1);
            expect(game.getBonusIndex(nextBuzzCycleIndex)).to.equal(-1);
            expect(game.getBonusIndex(nextBuzzCycleIndex + 1)).to.equal(-1);
        });
    });
});

function createDefaultGame(pairTossupsBonuses?: boolean): GameState {
    const game: GameState = new GameState();
    game.addPlayers(players);
    game.loadPacket(defaultPacket);

    if (pairTossupsBonuses) {
        game.setGameFormat({ ...game.gameFormat, pairTossupsBonuses: true });
    }

    return game;
}
