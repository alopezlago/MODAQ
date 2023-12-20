import { expect } from "chai";

import { Player } from "src/state/TeamState";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup, Bonus } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";

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
    describe("protestsMatter", () => {
        it("Tie game, no protests", () => {
            const game: GameState = createDefaultGame();
            expect(game.protestsMatter).to.be.false;
        });
        it("Tie game, tossup protests", () => {
            const game: GameState = createDefaultGame();
            game.setGameFormat({ ...game.gameFormat, negValue: 0 });
            game.cycles[0].addWrongBuzz(
                { player: firstTeamPlayer, points: 0, position: 2, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addTossupProtest(firstTeamPlayer.teamName, 0, 2, "My answer", "My reason");
            expect(game.protestsMatter).to.be.true;
        });
        it("Tie game, bonus protests", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );

            game.cycles[1].addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 1, isLastWord: false },
                0,
                game.gameFormat,
                1,
                1
            );
            game.cycles[1].addBonusProtest(1, 0, "My answer", "My reason", secondTeamPlayer.teamName);

            expect(game.protestsMatter).to.be.true;
        });
        it("Uneven game, protests don't matter", () => {
            const game: GameState = createDefaultGame();
            // 20-0
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );
            game.cycles[0].setBonusPartAnswer(0, firstTeamPlayer.teamName, 10);

            // 60-0
            game.cycles[1].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 1, isLastWord: false },
                0,
                game.gameFormat,
                1,
                1
            );
            game.cycles[1].setBonusPartAnswer(0, firstTeamPlayer.teamName, 10);
            game.cycles[1].setBonusPartAnswer(1, firstTeamPlayer.teamName, 10);
            game.cycles[1].setBonusPartAnswer(2, firstTeamPlayer.teamName, 10);

            // 60-0, so 10 + 30 points here and 10 points shouldn't make up for 60-0
            game.cycles[2].addWrongBuzz(
                { player: secondTeamPlayer, points: -5, position: 1, isLastWord: false },
                2,
                game.gameFormat
            );
            game.cycles[2].addTossupProtest(secondTeamPlayer.teamName, 2, 1, "My answer", "My reason");

            game.cycles[3].addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 0, isLastWord: false },
                3,
                game.gameFormat,
                2,
                1
            );
            game.cycles[3].addBonusProtest(1, 0, "My answer2", "My reason2", secondTeamPlayer.teamName);

            expect(game.protestsMatter).to.be.false;
        });
        it("Uneven game, tossup and bonus protests matter", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );
            game.cycles[0].setBonusPartAnswer(0, firstTeamPlayer.teamName, 10);

            game.cycles[1].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 1, isLastWord: false },
                0,
                game.gameFormat,
                1,
                1
            );

            // 30-0, so 15 points here and 10 points shouldn matter
            game.cycles[2].addWrongBuzz(
                { player: secondTeamPlayer, points: -5, position: 1, isLastWord: false },
                2,
                game.gameFormat
            );
            game.cycles[2].addTossupProtest(secondTeamPlayer.teamName, 2, 1, "My answer", "My reason");

            game.cycles[3].addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 0, isLastWord: false },
                3,
                game.gameFormat,
                2,
                1
            );
            game.cycles[3].addBonusProtest(1, 0, "My answer2", "My reason2", secondTeamPlayer.teamName);

            expect(game.protestsMatter).to.be.true;
        });
        it("Uneven game, tossup protest matters", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );

            // 30-0, so 15 points here and 10 points shouldn matter
            game.cycles[3].addWrongBuzz(
                { player: secondTeamPlayer, points: -5, position: 1, isLastWord: false },
                2,
                game.gameFormat
            );
            game.cycles[3].addTossupProtest(secondTeamPlayer.teamName, 2, 1, "My answer", "My reason");
            expect(game.protestsMatter).to.be.true;
        });
        it("Uneven game, bonus protest matters (for)", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );
            game.cycles[0].setBonusPartAnswer(0, firstTeamPlayer.teamName, 10);

            game.cycles[1].addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 1, isLastWord: false },
                0,
                game.gameFormat,
                1,
                1
            );
            game.cycles[1].addBonusProtest(1, 0, "My answer", "My reason", secondTeamPlayer.teamName);

            expect(game.protestsMatter).to.be.true;
        });
        it("Uneven game, bonus protest matters (against)", () => {
            const game: GameState = createDefaultGame();

            // 20-0, one protest
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );
            game.cycles[0].setBonusPartAnswer(0, firstTeamPlayer.teamName, 10);
            game.cycles[0].addBonusProtest(0, 0, "My answer", "My reason", secondTeamPlayer.teamName);

            // 20-10, one bonus protest (should tie since protest against correctness)
            game.cycles[1].addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 1, isLastWord: false },
                0,
                game.gameFormat,
                1,
                1
            );

            expect(game.protestsMatter).to.be.true;
        });
        it("Uneven game, protests matter, both teams have protests", () => {
            const game: GameState = createDefaultGame();
            game.cycles[0].addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                1
            );
            game.cycles[0].addBonusProtest(0, 0, "My answer", "My reason", firstTeamPlayer.teamName);

            // 30-0, so 15 points here and 10 points shouldn matter
            game.cycles[3].addWrongBuzz(
                { player: secondTeamPlayer, points: -5, position: 1, isLastWord: false },
                2,
                game.gameFormat
            );
            game.cycles[3].addTossupProtest(secondTeamPlayer.teamName, 2, 1, "My answer", "My reason");
            expect(game.protestsMatter).to.be.true;
        });
        it("Uneven game, tossup with bonus for other team would swing it", () => {
            const packet: PacketState = new PacketState();
            packet.setTossups([
                new Tossup("first q", "first a"),
                new Tossup("second q", "second a"),
                new Tossup("third q", "third a"),
                new Tossup("fourth q", "fourth a"),
            ]);
            packet.setBonuses([
                new Bonus("first leadin", [
                    { question: "first q", answer: "first a", value: 10 },
                    { question: "first q2", answer: "first a2", value: 10 },
                    { question: "first q3", answer: "first a3", value: 10 },
                ]),
                new Bonus("second leadin", [
                    { question: "second q", answer: "second a", value: 10 },
                    { question: "second q2", answer: "second a2", value: 10 },
                    { question: "second q3", answer: "second a3", value: 10 },
                ]),
                new Bonus("third leadin", [
                    { question: "third q", answer: "third a", value: 10 },
                    { question: "third q2", answer: "third a2", value: 10 },
                    { question: "third q3", answer: "third a3", value: 10 },
                ]),
            ]);

            const game: GameState = new GameState();
            game.addNewPlayers(players);
            game.loadPacket(defaultPacket);

            // 30-0
            const firstCycle: Cycle = game.cycles[0];
            firstCycle.addCorrectBuzz(
                { player: firstTeamPlayer, points: 10, position: 2, isLastWord: false },
                0,
                game.gameFormat,
                0,
                3
            );
            firstCycle.setBonusPartAnswer(0, firstTeamPlayer.teamName, 10);
            firstCycle.setBonusPartAnswer(1, firstTeamPlayer.teamName, 10);
            expect(game.protestsMatter).to.be.false;

            // 25-40, but protest neg
            const secondCycle: Cycle = game.cycles[1];
            secondCycle.addWrongBuzz(
                { player: firstTeamPlayer, points: -5, position: 1, isLastWord: false },
                1,
                game.gameFormat
            );
            secondCycle.addTossupProtest(firstTeamPlayer.teamName, 2, 1, "My answer", "My reason");
            secondCycle.addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 2, isLastWord: false },
                1,
                game.gameFormat,
                1,
                3
            );
            secondCycle.setBonusPartAnswer(0, secondTeamPlayer.teamName, 10);
            secondCycle.setBonusPartAnswer(1, secondTeamPlayer.teamName, 10);
            expect(game.protestsMatter).to.be.true;

            // 25-50... protestMatter should still be true, since the protest in the second question should flip it
            const thirdCycle: Cycle = game.cycles[2];
            thirdCycle.addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 2, isLastWord: false },
                2,
                game.gameFormat,
                2,
                3
            );
            expect(game.protestsMatter).to.be.true;
        });
    });
});

function createDefaultGame(): GameState {
    const game: GameState = new GameState();
    game.addNewPlayers(players);
    game.loadPacket(defaultPacket);
    return game;
}
