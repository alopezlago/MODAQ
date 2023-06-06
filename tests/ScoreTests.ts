import { expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import { Player } from "src/state/TeamState";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup, Bonus } from "src/state/PacketState";

const firstTeamPlayer: Player = new Player("Alice", "A", /* isStarter */ true);
const secondTeamPlayer: Player = new Player("Bob", "B", /* isStarter */ true);
const players: Player[] = [firstTeamPlayer, secondTeamPlayer];

const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([
    new Tossup("power before (*) first q", "first a"),
    new Tossup("power before (*) second q", "second a"),
]);
defaultPacket.setBonuses([
    new Bonus("first leadin", [{ question: "first q", answer: "first a", value: 10 }]),
    new Bonus("second leadin", [{ question: "second q", answer: "second a", value: 10 }]),
]);

describe("GameStateTests", () => {
    describe("score", () => {
        it("Initial game", () => {
            const game: GameState = createDefaultGame();
            expect(game.scores[0]).to.deep.equal([0, 0]);
        });
        it("Game with more than two teams", () => {
            const game: GameState = new GameState();
            const thirdPlayer: Player = new Player("Charlie", "C", /* isStarter */ true);
            game.addPlayers(players.concat(thirdPlayer));
            game.loadPacket(defaultPacket);
            game.setGameFormat(GameFormats.StandardPowersMACFGameFormat);
            expect(game.scores[0]).to.deep.equal([0, 0, 0]);

            game.cycles[0].addWrongBuzz(
                { player: thirdPlayer, points: -5, position: 2, isLastWord: false },
                0,
                game.gameFormat
            );

            expect(game.scores[0]).to.deep.equal([0, 0, -5]);
        });
        it("Neg with zero-point neg format", () => {
            const game: GameState = createDefaultGame();
            game.setGameFormat({ ...game.gameFormat, negValue: 0 });
            game.cycles[0].addWrongBuzz(
                { player: firstTeamPlayer, points: 0, position: 2, isLastWord: false },
                0,
                game.gameFormat
            );
            expect(game.scores[0]).to.deep.equal([0, 0]);
        });
        it("Two correct buzzes", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );

            game.cycles[1].addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                1,
                1
            );

            expect(game.scores[0]).to.deep.equal([10, 0]);
            expect(game.scores[1]).to.deep.equal([10, 10]);
        });
        it("Correct buzz with bonus", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );
            game.cycles[0].setBonusPartAnswer(0, firstTeamPlayer.teamName, 10);

            expect(game.scores[0]).to.deep.equal([20, 0]);

            game.cycles[1].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 3, isLastWord: false },
                0,
                game.gameFormat,
                1,
                1
            );
            expect(game.scores[1]).to.deep.equal([30, 0]);
        });
        it("Power", () => {
            const game: GameState = createDefaultGame();
            // Say 10 points, but it should be calculated from the game format, which says it's 15
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 0, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );

            expect(game.scores[0]).to.deep.equal([15, 0]);

            // Should revert to 10 points after a game format change
            game.setGameFormat(GameFormats.ACFGameFormat);
            expect(game.scores[0]).to.deep.equal([10, 0]);

            // And back to a power after resetting the format
            game.setGameFormat(GameFormats.StandardPowersMACFGameFormat);
            expect(game.scores[0]).to.deep.equal([15, 0]);
        });
        it("Neg", () => {
            const game: GameState = createDefaultGame();
            // Say 10 points, but it should be calculated from the game format, which says it's 15
            game.cycles[0].addWrongBuzz(
                { player: secondTeamPlayer, points: 0, position: 1, isLastWord: false },
                0,
                game.gameFormat
            );

            expect(game.scores[0]).to.deep.equal([0, -5]);

            // Should revert to 0 points after a game format change
            game.setGameFormat(GameFormats.PACEGameFormat);
            expect(game.scores[0]).to.deep.equal([0, 0]);

            // And back to a neg after resetting the format
            game.setGameFormat(GameFormats.StandardPowersMACFGameFormat);
            expect(game.scores[0]).to.deep.equal([0, -5]);
        });
        it("No penalty", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addWrongBuzz(
                { player: secondTeamPlayer, points: 0, position: 4, isLastWord: true },
                0,
                game.gameFormat
            );

            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 4, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );

            expect(game.scores[0]).to.deep.equal([10, 0]);
        });
        it("No penalties", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addWrongBuzz(
                { player: firstTeamPlayer, points: 0, position: 4, isLastWord: true },
                0,
                game.gameFormat
            );
            game.cycles[0].addWrongBuzz(
                { player: secondTeamPlayer, points: 0, position: 4, isLastWord: true },
                0,
                game.gameFormat
            );

            expect(game.scores[0]).to.deep.equal([0, 0]);
        });
        it("Neg followed by no penalty", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addWrongBuzz(
                { player: firstTeamPlayer, points: 0, position: 3, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addWrongBuzz(
                { player: secondTeamPlayer, points: 0, position: 4, isLastWord: true },
                0,
                game.gameFormat
            );

            expect(game.scores[0]).to.deep.equal([-5, 0]);
        });
        it("Neg and no penalty on the same word", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addWrongBuzz(
                { player: firstTeamPlayer, points: 0, position: 3, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addWrongBuzz(
                { player: secondTeamPlayer, points: 0, position: 3, isLastWord: true },
                0,
                game.gameFormat
            );

            expect(game.scores[0]).to.deep.equal([-5, 0]);
        });
        // Verify neg, no penalty on all Sheets tests and QBJ
    });
});

function createDefaultGame(): GameState {
    const game: GameState = new GameState();
    game.addPlayers(players);
    game.loadPacket(defaultPacket);
    game.setGameFormat(GameFormats.StandardPowersMACFGameFormat);
    return game;
}
