import { expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import * as QBJ from "src/qbj/QBJ";
import * as NewGameValidator from "src/state/NewGameValidator";
import * as PendingNewGameUtils from "src/state/PendingNewGameUtils";
import { GameState } from "src/state/GameState";
import { IGameFormat } from "src/state/IGameFormat";
import { IPendingNewGame, PendingGameType } from "src/state/IPendingNewGame";
import { PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";

const packet: PacketState = new PacketState();
packet.setTossups([
    new Tossup("power before (*) first q", "first a"),
    new Tossup("power before (*) second q", "second a"),
]);

// Each competitor in an individual game is their own one-player team, so their name is their team name
function createIndividualPlayers(count: number): Player[] {
    const players: Player[] = [];
    for (let i = 0; i < count; i++) {
        const name = `Player ${i + 1}`;
        players.push(new Player(name, name, /* isStarter */ true));
    }

    return players;
}

function createIndividualGame(playerCount: number, gameFormat?: IGameFormat): GameState {
    const game: GameState = new GameState();
    game.addNewPlayers(createIndividualPlayers(playerCount));
    game.loadPacket(packet);
    game.setGameFormat(gameFormat ?? GameFormats.IPNCTGameFormat);
    return game;
}

function createPendingIndividualGame(players: Player[], gameFormat?: IGameFormat): IPendingNewGame {
    return {
        packet,
        type: PendingGameType.Manual,
        gameFormat: gameFormat ?? GameFormats.IPNCTGameFormat,
        manual: {
            firstTeamPlayers: [],
            secondTeamPlayers: [],
            individualPlayers: players,
        },
    };
}

describe("IndividualFormatTests", () => {
    describe("format", () => {
        it("IPNCT is one of the known formats", () => {
            expect(GameFormats.getKnownFormats()).to.contain(GameFormats.IPNCTGameFormat);
        });
        it("The freeform format stays last, since the picker falls back to it", () => {
            const knownFormats: IGameFormat[] = GameFormats.getKnownFormats();
            expect(knownFormats[knownFormats.length - 1]).to.equal(GameFormats.UndefinedGameFormat);
        });
        it("IPNCT is individual, tossups only, and negs every wrong buzz", () => {
            expect(GameFormats.isIndividualFormat(GameFormats.IPNCTGameFormat)).to.be.true;
            expect(GameFormats.hasBonuses(GameFormats.IPNCTGameFormat)).to.be.false;
            expect(GameFormats.negsForEveryWrongBuzz(GameFormats.IPNCTGameFormat)).to.be.true;
            expect(GameFormats.getMaximumTeamCount(GameFormats.IPNCTGameFormat)).to.equal(16);
        });
        it("Team formats are unaffected", () => {
            for (const gameFormat of [GameFormats.ACFGameFormat, GameFormats.StandardPowersMACFGameFormat]) {
                expect(GameFormats.isIndividualFormat(gameFormat)).to.be.false;
                expect(GameFormats.hasBonuses(gameFormat)).to.be.true;
                expect(GameFormats.negsForEveryWrongBuzz(gameFormat)).to.be.false;
                expect(GameFormats.getMaximumTeamCount(gameFormat)).to.equal(2);
            }
        });
        it("A hand-edited player count is clamped to what the app supports", () => {
            expect(
                GameFormats.getMaximumTeamCount({ ...GameFormats.IPNCTGameFormat, maximumPlayerCount: 100 })
            ).to.equal(16);
            expect(GameFormats.getMaximumTeamCount({ ...GameFormats.IPNCTGameFormat, maximumPlayerCount: 1 })).to.equal(
                2
            );
        });
        it("An older format without the new fields still upgrades", () => {
            const gameFormat: IGameFormat = { ...GameFormats.ACFGameFormat, version: "2021-07-11" };
            const upgradedFormat: IGameFormat = GameFormats.getUpgradedFormatVersion(gameFormat);
            expect(GameFormats.isIndividualFormat(upgradedFormat)).to.be.false;
            expect(GameFormats.negsForEveryWrongBuzz(upgradedFormat)).to.be.false;
            expect(GameFormats.hasBonuses(upgradedFormat)).to.be.true;
        });
    });

    describe("multiple negs on a tossup", () => {
        it("Every player who buzzes early negs", () => {
            const game: GameState = createIndividualGame(3);
            const [first, second, third]: Player[] = game.players;

            game.cycles[0].addWrongBuzz(
                { player: first, points: -5, position: 1, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addWrongBuzz(
                { player: second, points: -5, position: 2, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addWrongBuzz(
                { player: third, points: -5, position: 3, isLastWord: false },
                0,
                game.gameFormat
            );

            expect(game.scores[0]).to.deep.equal([-5, -5, -5]);
        });
        it("A format without the rule only penalizes the first wrong buzz", () => {
            const game: GameState = createIndividualGame(3, {
                ...GameFormats.IPNCTGameFormat,
                negsForEveryWrongBuzz: false,
            });
            const [first, second]: Player[] = game.players;

            game.cycles[0].addWrongBuzz(
                { player: first, points: -5, position: 1, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addWrongBuzz(
                { player: second, points: 0, position: 2, isLastWord: false },
                0,
                game.gameFormat
            );

            expect(game.scores[0]).to.deep.equal([-5, 0, 0]);
        });
        it("A buzz at the end of the question is never a neg", () => {
            const game: GameState = createIndividualGame(2);
            const [first, second]: Player[] = game.players;

            game.cycles[0].addWrongBuzz(
                { player: first, points: -5, position: 1, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addWrongBuzz(
                { player: second, points: 0, position: 5, isLastWord: true },
                0,
                game.gameFormat
            );

            expect(game.scores[0]).to.deep.equal([-5, 0]);
        });
        it("Negs and a correct buzz score together", () => {
            const game: GameState = createIndividualGame(3);
            const [first, second, third]: Player[] = game.players;

            game.cycles[0].addWrongBuzz(
                { player: first, points: -5, position: 1, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addWrongBuzz(
                { player: second, points: -5, position: 2, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addCorrectBuzz(
                { player: third, points: 10, position: 4, isLastWord: false },
                0,
                game.gameFormat,
                /* bonusIndex */ undefined,
                /* partsCount */ undefined
            );

            expect(game.scores[0]).to.deep.equal([-5, -5, 10]);
        });
        it("Removing a wrong buzz leaves the other negs alone", () => {
            const game: GameState = createIndividualGame(3);
            const [first, second, third]: Player[] = game.players;

            const buzzers: Player[] = [first, second, third];
            for (let i = 0; i < buzzers.length; i++) {
                game.cycles[0].addWrongBuzz(
                    { player: buzzers[i], points: -5, position: i + 1, isLastWord: false },
                    0,
                    game.gameFormat
                );
            }

            game.cycles[0].removeWrongBuzz(second, game.gameFormat);

            expect(game.scores[0]).to.deep.equal([-5, 0, -5]);
        });
        it("A buzz inserted before the others still negs everyone", () => {
            const game: GameState = createIndividualGame(2);
            const [first, second]: Player[] = game.players;

            game.cycles[0].addWrongBuzz(
                { player: second, points: -5, position: 3, isLastWord: false },
                0,
                game.gameFormat
            );

            // A penalty-free buzz added earlier: in a team format this is what makes the later buzz a no-penalty
            // buzz, but here both players negged
            game.cycles[0].addWrongBuzz(
                { player: first, points: 0, position: 1, isLastWord: false },
                0,
                game.gameFormat
            );

            expect(game.scores[0]).to.deep.equal([-5, -5]);
        });
    });

    describe("games with many competitors", () => {
        it("Sixteen players each keep their own score", () => {
            const game: GameState = createIndividualGame(16);
            expect(game.teamNames.length).to.equal(16);

            game.cycles[0].addCorrectBuzz(
                { player: game.players[15], points: 10, position: 4, isLastWord: false },
                0,
                game.gameFormat,
                /* bonusIndex */ undefined,
                /* partsCount */ undefined
            );

            const expectedScores: number[] = new Array(16).fill(0);
            expectedScores[15] = 10;
            expect(game.scores[0]).to.deep.equal(expectedScores);
        });
        it("Protests are flagged even though the swing math only handles two teams", () => {
            const game: GameState = createIndividualGame(3);
            expect(game.protestsMatter).to.be.false;

            game.cycles[0].addWrongBuzz(
                { player: game.players[0], points: -5, position: 1, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addTossupProtest(game.players[0].teamName, 0, 1, "answer", "reason");

            expect(game.protestsMatter).to.be.true;
        });
    });

    describe("QBJ round trip", () => {
        function playedIndividualGame(playerCount: number): GameState {
            const game: GameState = createIndividualGame(playerCount);
            const tossup = game.packet.tossups[0];

            // Two early negs and a conversion, which only an individual format scores this way
            game.cycles[0].addWrongBuzz(
                { player: game.players[0], points: -5, position: 1, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addWrongBuzz(
                { player: game.players[1], points: -5, position: 2, isLastWord: false },
                0,
                game.gameFormat
            );
            game.cycles[0].addCorrectBuzz(
                {
                    player: game.players[2],
                    points: tossup.getPointsAtPosition(game.gameFormat, 4, /* isCorrect */ true),
                    position: 4,
                    isLastWord: false,
                },
                0,
                game.gameFormat,
                /* bonusIndex */ undefined,
                /* partsCount */ undefined
            );

            return game;
        }

        it("An individual game exports one match team per competitor", () => {
            const qbj: QBJ.IMatch = QBJ.toQBJ(playedIndividualGame(12), "packet", 1);
            expect(qbj.match_teams.length).to.equal(12);
            expect(qbj.match_teams.every((team) => team.match_players.length === 1)).to.be.true;
        });
        it("Every neg keeps its value in the export", () => {
            const qbj: QBJ.IMatch = QBJ.toQBJ(playedIndividualGame(3), "packet", 1);
            const values: number[] = qbj.match_questions[0].buzzes.map((buzz) => buzz.result.value);
            expect(values.filter((value) => value === -5).length).to.equal(2);
        });
        it("A 12-competitor game reads back in with the same scores", () => {
            const game: GameState = playedIndividualGame(12);
            const expected: number[] = game.scores[0];

            const qbj: QBJ.IMatch = QBJ.toQBJ(game, "packet", 1);
            const result = QBJ.fromQBJ(qbj, game.packet, GameFormats.IPNCTGameFormat);

            expect(result.success, result.success ? "" : result.message).to.be.true;
            if (result.success) {
                expect(result.value.teamNames.length).to.equal(12);
                expect(result.value.scores[0]).to.deep.equal(expected);
            }
        });
        it("A team format still refuses a game with more than two teams", () => {
            const qbj: QBJ.IMatch = QBJ.toQBJ(playedIndividualGame(12), "packet", 1);
            const result = QBJ.fromQBJ(qbj, packet, GameFormats.ACFGameFormat);

            expect(result.success).to.be.false;
            if (!result.success) {
                expect(result.message).to.contain("2 teams");
            }
        });
        it("A game with only one competitor is refused", () => {
            const qbj: QBJ.IMatch = QBJ.toQBJ(playedIndividualGame(3), "packet", 1);
            qbj.match_teams = qbj.match_teams.slice(0, 1);
            const result = QBJ.fromQBJ(qbj, packet, GameFormats.IPNCTGameFormat);

            expect(result.success).to.be.false;
        });
        it("More competitors than the format allows is refused", () => {
            const qbj: QBJ.IMatch = QBJ.toQBJ(playedIndividualGame(12), "packet", 1);
            const result = QBJ.fromQBJ(qbj, packet, {
                ...GameFormats.IPNCTGameFormat,
                maximumPlayerCount: 8,
            });

            expect(result.success).to.be.false;
            if (!result.success) {
                expect(result.message).to.contain("at most 8 players");
            }
        });
    });

    describe("new game validation", () => {
        it("An individual game with sixteen players is valid", () => {
            expect(NewGameValidator.isValid(createPendingIndividualGame(createIndividualPlayers(16)))).to.be.true;
        });
        it("An individual game with one player is invalid", () => {
            expect(NewGameValidator.isValid(createPendingIndividualGame(createIndividualPlayers(1)))).to.be.false;
        });
        it("An individual game over the player cap is invalid", () => {
            expect(NewGameValidator.isValid(createPendingIndividualGame(createIndividualPlayers(17)))).to.be.false;
        });
        it("Blank entries are skipped rather than failing the game", () => {
            const players: Player[] = createIndividualPlayers(3).concat(new Player("", "", /* isStarter */ true));
            expect(NewGameValidator.isValid(createPendingIndividualGame(players))).to.be.true;
        });
        it("Two players with the same name are invalid", () => {
            const players: Player[] = createIndividualPlayers(3);
            players[2].setName(players[0].name);
            players[2].setTeamName(players[0].teamName);
            expect(NewGameValidator.isValid(createPendingIndividualGame(players))).to.be.false;
        });
        it("Each competitor becomes their own one-player team", () => {
            const teams: Player[][] = PendingNewGameUtils.getPendingNewGamePlayers(
                createPendingIndividualGame(createIndividualPlayers(4))
            );
            expect(teams.length).to.equal(4);
            expect(teams.every((team) => team.length === 1)).to.be.true;
        });
        it("A team format still reads the two team rosters", () => {
            const pendingNewGame: IPendingNewGame = createPendingIndividualGame(
                createIndividualPlayers(4),
                GameFormats.ACFGameFormat
            );
            if (pendingNewGame.type === PendingGameType.Manual) {
                pendingNewGame.manual.firstTeamPlayers = [new Player("Alice", "A", /* isStarter */ true)];
                pendingNewGame.manual.secondTeamPlayers = [new Player("Bob", "B", /* isStarter */ true)];
            }

            const teams: Player[][] = PendingNewGameUtils.getPendingNewGamePlayers(pendingNewGame);
            expect(teams.length).to.equal(2);
            expect(teams[0][0].name).to.equal("Alice");
            expect(teams[1][0].name).to.equal("Bob");
        });
    });
});
