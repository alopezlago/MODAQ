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
    describe("getTossupIndex", () => {
        it("No thrown out tossups", () => {
            const game: GameState = createDefaultGame();

            for (let i = 0; i < game.cycles.length; i++) {
                expect(game.getTossupIndex(i)).to.equal(i);
            }
        });
        it("One thrown out tossup", () => {
            const game: GameState = createDefaultGame();
            const thrownOutTossupCycleIndex = 1;
            game.cycles[thrownOutTossupCycleIndex].addThrownOutTossup(0);

            expect(game.getTossupIndex(0)).to.equal(0);
            expect(game.getTossupIndex(thrownOutTossupCycleIndex)).to.equal(thrownOutTossupCycleIndex + 1);
            expect(game.getTossupIndex(thrownOutTossupCycleIndex + 1)).to.equal(thrownOutTossupCycleIndex + 2);
        });
        it("Multiple thrown out tossups", () => {
            const game: GameState = createDefaultGame();
            const thrownOutTossupCycleIndex = 1;
            const cycle: Cycle = game.cycles[thrownOutTossupCycleIndex];
            cycle.addThrownOutTossup(0);
            cycle.addThrownOutTossup(1);

            expect(game.getTossupIndex(0)).to.equal(0);
            expect(game.getTossupIndex(thrownOutTossupCycleIndex)).to.equal(thrownOutTossupCycleIndex + 2);
            expect(game.getTossupIndex(thrownOutTossupCycleIndex + 1)).to.equal(thrownOutTossupCycleIndex + 3);
        });
    });
});

function createDefaultGame(): GameState {
    const game: GameState = new GameState();
    game.addNewPlayers(players);
    game.loadPacket(defaultPacket);
    return game;
}
