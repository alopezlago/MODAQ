import { assert, expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import * as QBJ from "src/qbj/QBJ";
import { IMatch, ITournament } from "src/qbj/QBJ";
import { GameState } from "src/state/GameState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";
import { IGameFormat } from "src/state/IGameFormat";
import { IResult } from "src/IResult";
import { Cycle } from "src/state/Cycle";

const firstTeamPlayers: Player[] = [
    new Player("Alice", "A", /* isStarter */ true),
    new Player("Alan", "A", /* isStarter */ true),
    new Player("Anna", "A", /* isStarter */ false),
];
const secondTeamPlayer: Player = new Player("Bob", "B", /* isStarter */ true);
const players: Player[] = firstTeamPlayers.concat(secondTeamPlayer);

const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([
    new Tossup("first q", "first a"),
    new Tossup("second q", "second a"),
    new Tossup("third q (*) has a power marker", "third a"),
    new Tossup("fourth q", "fourth a"),
]);
defaultPacket.setBonuses([
    new Bonus("first leadin", [
        { question: "first q", answer: "first a", value: 10 },
        { question: "first q 2", answer: "first a 2", value: 10 },
        { question: "first q 3", answer: "first a 3", value: 10 },
    ]),
    new Bonus("second leadin", [
        { question: "second q", answer: "second a", value: 10 },
        { question: "second q 2", answer: "second a 2", value: 10 },
        { question: "second q 3", answer: "second a 3", value: 10 },
    ]),
    new Bonus("third leadin", [
        { question: "third q", answer: "third a", value: 10 },
        { question: "third q 2", answer: "third a 2", value: 10 },
        { question: "third q 3", answer: "third a 3", value: 10 },
    ]),
    new Bonus("fourth leadin", [
        { question: "fourth q", answer: "fourth a", value: 10 },
        { question: "fourth q 2", answer: "fourth a 2", value: 10 },
        { question: "fourth q 3", answer: "fourth a 3", value: 10 },
    ]),
]);

function createDefaultMatch(): IMatch {
    const game: GameState = new GameState();
    game.loadPacket(defaultPacket);
    game.setPlayers(players);
    game.setGameFormat(GameFormats.ACFGameFormat);
    return QBJ.toQBJ(game, "Packet", 1);
}

function verifyBuzz(buzz: QBJ.IMatchQuestionBuzz, player: Player, position: number, points: number): void {
    expect(buzz.buzz_position.word_index).to.equal(position);
    expect(buzz.team.name).to.equal(player.teamName);
    expect(buzz.player.name).to.equal(player.name);
    expect(buzz.result.value).to.equal(points);
}

function verifyFromQBJ(match: IMatch, verifyGame: (game: GameState) => void): void {
    const result: IResult<GameState> = QBJ.fromQBJ(match, defaultPacket, GameFormats.ACFGameFormat);
    if (!result.success) {
        assert.fail(`Failed to parse the QBJ file into a game. Error: '${result.message}'`);
    }

    verifyGame(result.value);
}

function verifyToQBJ(
    updateGame: (game: GameState) => void,
    verifyMatch: (match: IMatch, game: GameState) => void
): void {
    const game: GameState = new GameState();
    game.loadPacket(defaultPacket);
    game.addNewPlayers(players);
    updateGame(game);

    const qbj: string = QBJ.toQBJString(game);
    expect(qbj).to.not.be.undefined;
    const match: IMatch = JSON.parse(qbj);
    verifyMatch(match, game);
}

function verifyFromQBJRoundtrip(game: GameState): void {
    const qbj: IMatch = QBJ.toQBJ(game, "Packet", 1);
    const roundtrippedGameResult: IResult<GameState> = QBJ.fromQBJ(qbj, game.packet, game.gameFormat);

    if (!roundtrippedGameResult.success) {
        assert.fail(`Failed to parse the QBJ. Error: '${roundtrippedGameResult.message}'`);
    }

    const roundtrippedGame: GameState = roundtrippedGameResult.value;
    expect(roundtrippedGame).to.not.be.undefined;
    expect(roundtrippedGame.players).to.deep.equal(game.players);
    expect(roundtrippedGame.packet).to.deep.equal(game.packet);

    // We can't use deep equal aganist cycles because protests aren't preserved. So compare individual fields
    expect(roundtrippedGame.cycles.length).to.equal(game.cycles.length, "Cycle lengths don't match");
    for (let i = 0; i < game.cycles.length; i++) {
        const expectedCycle: Cycle = game.cycles[i];
        const roundtrippedCycle: Cycle = roundtrippedGame.cycles[i];

        expect(roundtrippedCycle.bonusAnswer).to.deep.equal(
            expectedCycle.bonusAnswer,
            `Bonus answer mismatch at index ${i}`
        );
        expect(roundtrippedCycle.correctBuzz).to.deep.equal(
            expectedCycle.correctBuzz,
            `Correct buzz mismatch at index ${i}`
        );

        expect(roundtrippedCycle.thrownOutBonuses).to.deep.equal(
            expectedCycle.thrownOutBonuses,
            `Thrown out bonuses mismatch at index ${i}`
        );
        expect(roundtrippedCycle.thrownOutTossups).to.deep.equal(
            expectedCycle.thrownOutTossups,
            `Thrown out tossups mismatch at index ${i}`
        );

        // Player order for subs and join/leave differ, so just make sure that the names are in each others sets
        for (const teamName of game.teamNames) {
            const roundtrippedActivePlayers: Set<Player> = roundtrippedGame.getActivePlayers(teamName, i);
            const originalActivePlayers: Set<Player> = game.getActivePlayers(teamName, i);
            expect(roundtrippedActivePlayers.size).to.equal(
                originalActivePlayers.size,
                `Active players size different at index ${i}`
            );

            for (const player of originalActivePlayers.values()) {
                expect(
                    roundtrippedActivePlayers.has(player),
                    `Player '${player.name}' of team '${player.teamName}' not found in roundtripped players at index ${i}`
                );
            }
        }
    }
}

describe("QBJTests", () => {
    describe("fromQBJ", () => {
        it("No buzz game", () => {
            const firstTeamPlayers: QBJ.IPlayer[] = [{ name: "Alice" }, { name: "Andy" }];
            const secondTeamPlayers: QBJ.IPlayer[] = [{ name: "Bob" }];

            const match: IMatch = {
                match_questions: [
                    {
                        buzzes: [],
                        question_number: 1,
                        tossup_question: { question_number: 1, type: "tossup", parts: 1 },
                    },
                ],
                match_teams: [
                    {
                        bonus_points: 0,
                        team: {
                            name: "Alpha",
                            players: firstTeamPlayers,
                        },
                        lineups: [{ first_question: 0, players: firstTeamPlayers }],
                        match_players: firstTeamPlayers.map<QBJ.IMatchPlayer>((player) => {
                            return { player, answer_counts: [], tossups_heard: defaultPacket.tossups.length };
                        }),
                    },
                    {
                        bonus_points: 0,
                        team: {
                            name: "Beta",
                            players: secondTeamPlayers,
                        },
                        lineups: [{ first_question: 0, players: secondTeamPlayers }],
                        match_players: secondTeamPlayers.map<QBJ.IMatchPlayer>((player) => {
                            return { player, answer_counts: [], tossups_heard: defaultPacket.tossups.length };
                        }),
                    },
                ],
                tossups_read: 2,
            };

            verifyFromQBJ(match, (game) => {
                expect(game.finalScore).to.deep.equal([0, 0]);
                expect(game.cycles.length).to.equal(defaultPacket.tossups.length);
                for (let i = 0; i < defaultPacket.tossups.length; i++) {
                    if (game.cycles[i].correctBuzz != undefined) {
                        assert.fail("Correct buzz found at index " + i);
                    }
                }
            });
        });

        it("Game->QBJ->Game round trip", () => {
            const game: GameState = new GameState();
            game.loadPacket(defaultPacket);
            game.setPlayers(players);
            game.setGameFormat(GameFormats.ACFGameFormat);

            // Add a variety of events
            // - Team 1 negs on question 1, team 2 gets it, gets the second and third bonus parts. Bonus protest 1st one, tossup protest 1st one
            // - Leave/join for team 1. TU 2 is thrown out. TU is answered by team 1
            // - Team 1 gets first part of bonus
            // - Sub for team 2. The sub gets TU 3
            // - Bonus 3 is thrown out. Parts 1 gotten.
            const firstCycle: Cycle = game.cycles[0];
            firstCycle.addWrongBuzz(
                { player: firstTeamPlayers[0], points: -5, position: 0, isLastWord: false },
                0,
                GameFormats.ACFGameFormat
            );
            firstCycle.addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 1 },
                0,
                GameFormats.ACFGameFormat,
                0,
                3
            );
            firstCycle.setBonusPartAnswer(1, secondTeamPlayer.teamName, 10);
            firstCycle.setBonusPartAnswer(2, secondTeamPlayer.teamName, 10);
            firstCycle.addBonusProtest(0, 0, "Right", "Reason", secondTeamPlayer.teamName);

            const secondCycle: Cycle = game.cycles[1];
            secondCycle.addThrownOutTossup(1);
            secondCycle.addCorrectBuzz(
                {
                    player: firstTeamPlayers[1],
                    points: 10,
                    position: 1,
                },
                2,
                GameFormats.ACFGameFormat,
                1,
                3
            );
            secondCycle.setBonusPartAnswer(0, firstTeamPlayers[0].teamName, 10);

            const thirdCycle: Cycle = game.cycles[2];

            const newPlayer: Player = new Player("Brenda", secondTeamPlayer.teamName, /* isStarter */ false);
            game.addNewPlayer(newPlayer);
            thirdCycle.addPlayerJoins(newPlayer);
            thirdCycle.addPlayerLeaves(secondTeamPlayer);
            thirdCycle.addCorrectBuzz(
                { player: newPlayer, points: 10, position: 0 },
                3,
                GameFormats.ACFGameFormat,
                2,
                3
            );
            thirdCycle.addThrownOutBonus(2);
            thirdCycle.setBonusPartAnswer(0, secondTeamPlayer.teamName, 10);

            verifyFromQBJRoundtrip(game);
        });
        it("Roundtrip game with multiple thrown out tossups", () => {
            const game: GameState = new GameState();
            game.loadPacket(defaultPacket);
            game.setPlayers(players);
            game.setGameFormat(GameFormats.ACFGameFormat);

            const firstCycle: Cycle = game.cycles[0];
            firstCycle.addThrownOutTossup(0);
            firstCycle.addThrownOutTossup(1);
            firstCycle;
            firstCycle.addWrongBuzz(
                { player: firstTeamPlayers[0], points: -5, position: 0, isLastWord: false },
                2,
                GameFormats.ACFGameFormat
            );
            firstCycle.addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 1 },
                2,
                GameFormats.ACFGameFormat,
                0,
                3
            );
            firstCycle.setBonusPartAnswer(0, secondTeamPlayer.teamName, 10);

            verifyFromQBJRoundtrip(game);
        });
        it("Roundtrip game with multiple thrown out bonuses", () => {
            const game: GameState = new GameState();
            game.loadPacket(defaultPacket);
            game.setPlayers(players);
            game.setGameFormat(GameFormats.ACFGameFormat);

            const firstCycle: Cycle = game.cycles[0];
            firstCycle.addCorrectBuzz(
                { player: secondTeamPlayer, points: 10, position: 1 },
                0,
                GameFormats.ACFGameFormat,
                0,
                3
            );
            firstCycle.addThrownOutBonus(0);
            firstCycle.addThrownOutBonus(1);
            firstCycle.setBonusPartAnswer(2, secondTeamPlayer.teamName, 10);

            verifyFromQBJRoundtrip(game);
        });
        it("Invalid QBJ - undefined and empty match_players", () => {
            const match: IMatch = createDefaultMatch();
            if (match.match_teams) {
                match.match_teams[1].match_players = (undefined as unknown) as QBJ.IMatchPlayer[];
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;

            match.match_teams[1].match_players = [] as QBJ.IMatchPlayer[];

            const secondResult: IResult<GameState> = QBJ.fromQBJ(match, defaultPacket, GameFormats.ACFGameFormat);
            expect(secondResult.success).to.be.false;
        });
        it("Invalid QBJ - less than 2 teams", () => {
            const match: IMatch = createDefaultMatch();
            match.match_teams = [
                {
                    bonus_points: 0,
                    team: {
                        name: "Alpha",
                        players: firstTeamPlayers,
                    },
                    lineups: [{ first_question: 0, players: firstTeamPlayers }],
                    match_players: firstTeamPlayers.map<QBJ.IMatchPlayer>((player) => {
                        return { player, answer_counts: [], tossups_heard: defaultPacket.tossups.length };
                    }),
                },
            ];

            const result: IResult<GameState> = QBJ.fromQBJ(match, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - more than 2 teams", () => {
            const match: IMatch = createDefaultMatch();
            match.match_teams = ["Alpha", "Beta", "Gamma"].map((teamName) => {
                return {
                    bonus_points: 0,
                    team: {
                        name: teamName,
                        players: firstTeamPlayers,
                    },
                    lineups: [{ first_question: 0, players: firstTeamPlayers }],
                    match_players: firstTeamPlayers.map<QBJ.IMatchPlayer>((player) => {
                        return { player, answer_counts: [], tossups_heard: defaultPacket.tossups.length };
                    }),
                };
            });

            const result: IResult<GameState> = QBJ.fromQBJ(match, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - undefined and empty lineup", () => {
            const match: IMatch = createDefaultMatch();

            if (match.match_teams) {
                match.match_teams[0].lineups = (undefined as unknown) as QBJ.ILineup[];
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;

            match.match_teams[0].lineups = [];

            const secondResult: IResult<GameState> = QBJ.fromQBJ(match, defaultPacket, GameFormats.ACFGameFormat);
            expect(secondResult.success).to.be.false;
        });
        it("Invalid QBJ - undefined and empty match questoins", () => {
            const match: IMatch = createDefaultMatch();

            if (match.match_questions) {
                match.match_questions = (undefined as unknown) as QBJ.IMatchQuestion[];
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;

            match.match_questions = [];

            const secondResult: IResult<GameState> = QBJ.fromQBJ(match, defaultPacket, GameFormats.ACFGameFormat);
            expect(secondResult.success).to.be.false;
        });
        it("Invalid QBJ - negative bonus points", () => {
            const match: IMatch = createDefaultMatch();

            if (match.match_teams) {
                match.match_teams[0].bonus_points = -5;
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - same team name", () => {
            const match: IMatch = createDefaultMatch();
            const name = "Same";

            if (match.match_teams) {
                match.match_teams[0].team.name = name;
                match.match_teams[1].team.name = name;
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - empty player name", () => {
            const match: IMatch = createDefaultMatch();

            if (match.match_teams) {
                match.match_teams[0].match_players[0].player.name = "";
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - duplicate player name", () => {
            const match: IMatch = createDefaultMatch();
            const name = "Same";

            if (match.match_teams) {
                match.match_teams[0].match_players[0].player.name = name;
                match.match_teams[0].match_players[1].player.name = name;
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - buzz by undefined player", () => {
            const match: IMatch = createDefaultMatch();

            if (match.match_questions) {
                match.match_questions[0].buzzes = [
                    {
                        buzz_position: { word_index: 0 },
                        team: match.match_teams[0].team,
                        player: (undefined as unknown) as QBJ.IPlayer,
                        result: { value: -5 },
                    },
                ];
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - buzz by unknown player", () => {
            const match: IMatch = createDefaultMatch();

            if (match.match_questions) {
                const player: QBJ.IPlayer = { ...match.match_teams[0].match_players[0].player };
                player.name = "Some other guy";

                match.match_questions[0].buzzes = [
                    {
                        buzz_position: { word_index: 0 },
                        team: match.match_teams[0].team,
                        player,
                        result: { value: -5 },
                    },
                ];
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - lineups at invalid time", () => {
            const game: GameState = new GameState();
            game.loadPacket(defaultPacket);
            game.setPlayers(players);
            game.setGameFormat(GameFormats.ACFGameFormat);

            const newPlayer: Player = new Player("Arthur", game.teamNames[0], /* isStarter */ false);

            game.cycles[1].addSwapSubstitution(newPlayer, firstTeamPlayers[0]);

            const match: QBJ.IMatch = QBJ.toQBJ(game, "Packet", 1);

            if (match.match_teams) {
                match.match_teams[0].lineups[0].first_question = -1;
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;

            match.match_teams[0].lineups[0].first_question = game.packet.tossups.length + 1;
            const secondResult: IResult<GameState> = QBJ.fromQBJ(
                match as IMatch,
                defaultPacket,
                GameFormats.ACFGameFormat
            );
            expect(secondResult.success).to.be.false;
        });
        it("Invalid QBJ - lineups in wrong order", () => {
            const game: GameState = new GameState();
            game.loadPacket(defaultPacket);
            game.setPlayers(players);
            game.setGameFormat(GameFormats.ACFGameFormat);

            const newPlayer: Player = new Player("Arthur", game.teamNames[0], /* isStarter */ false);

            game.cycles[1].addSwapSubstitution(newPlayer, firstTeamPlayers[0]);

            const match: QBJ.IMatch = QBJ.toQBJ(game, "Packet", 1);

            if (match.match_teams) {
                match.match_teams[0].lineups[0].first_question = 2;
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - buzz at invalid time", () => {
            const match: IMatch = createDefaultMatch();

            if (match.match_questions) {
                match.match_questions[0].buzzes = [
                    {
                        buzz_position: { word_index: -1 },
                        team: match.match_teams[0].team,
                        player: match.match_teams[0].match_players[0].player,
                        result: { value: -5 },
                    },
                ];
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;

            match.match_questions[0].buzzes = [
                {
                    buzz_position: {
                        word_index: defaultPacket.tossups[0].getWords(GameFormats.ACFGameFormat).length + 1,
                    },
                    team: match.match_teams[0].team,
                    player: match.match_teams[0].match_players[0].player,
                    result: { value: -5 },
                },
            ];

            const secondResult: IResult<GameState> = QBJ.fromQBJ(
                match as IMatch,
                defaultPacket,
                GameFormats.ACFGameFormat
            );
            expect(secondResult.success).to.be.false;
        });
        it("Invalid QBJ - tossup answered during thrown out tossup", () => {
            const game: GameState = new GameState();
            game.loadPacket(defaultPacket);
            game.setPlayers(players);
            game.setGameFormat(GameFormats.ACFGameFormat);

            const match: QBJ.IMatch = QBJ.toQBJ(game, "Packet", 1);

            if (match.match_questions) {
                match.match_questions[0].buzzes = [
                    {
                        buzz_position: { word_index: 0 },
                        team: match.match_teams[0].team,
                        player: match.match_teams[0].match_players[0].player,
                        result: { value: 10 },
                    },
                ];
                match.match_questions[0].tossup_question.question_number = 2;

                match.match_questions[1].buzzes = [
                    {
                        buzz_position: { word_index: 1 },
                        team: match.match_teams[0].team,
                        player: match.match_teams[0].match_players[0].player,
                        result: { value: 10 },
                    },
                ];
                match.match_questions[1].tossup_question.question_number = 1;
            }

            const result: IResult<GameState> = QBJ.fromQBJ(match as IMatch, defaultPacket, GameFormats.ACFGameFormat);
            expect(result.success).to.be.false;
        });
        it("Invalid QBJ - undefined passed in", () => {
            const result: IResult<GameState> = QBJ.fromQBJ(
                (undefined as unknown) as IMatch,
                defaultPacket,
                GameFormats.ACFGameFormat
            );
            expect(result.success).to.be.false;
        });
    });
    describe("toQBJ", () => {
        it("No buzz game", () => {
            verifyToQBJ(
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                () => {},
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_teams.length).to.equal(2);
                    expect(match.match_teams[0].lineups).to.deep.equal([
                        {
                            first_question: 1,
                            players: firstTeamPlayers
                                .filter((p) => p.isStarter)
                                .map((p) => {
                                    return {
                                        name: p.name,
                                    };
                                }),
                        },
                    ]);
                    expect(match.match_teams[1].lineups).to.deep.equal([
                        {
                            first_question: 1,
                            players: [{ name: "Bob" }],
                        },
                    ]);
                    expect(match.match_questions.map((q) => q.buzzes).every((buzzes) => buzzes.length === 0)).to.be
                        .true;
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);
                }
            );
        });
        it("Four buzzes (-5, 0, 10, 15)", () => {
            verifyToQBJ(
                (game) => {
                    game.setGameFormat(GameFormats.StandardPowersMACFGameFormat);

                    game.cycles[0].addWrongBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: -5,
                            position: 0,
                            isLastWord: false,
                        },
                        0,
                        game.gameFormat
                    );
                    game.cycles[0].addWrongBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 0,
                            position: 1,
                            isLastWord: true,
                        },
                        0,
                        game.gameFormat
                    );

                    game.cycles[1].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[1],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );
                    game.cycles[1].setBonusPartAnswer(1, firstTeamPlayers[1].teamName, 10);

                    game.cycles[2].addCorrectBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 15,
                            position: 0,
                            isLastWord: false,
                        },
                        2,
                        game.gameFormat,
                        1,
                        3
                    );
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    const firstCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[0].buzzes;
                    expect(firstCycleBuzzes.length).to.equal(2);
                    verifyBuzz(firstCycleBuzzes[0], firstTeamPlayers[0], 0, -5);
                    verifyBuzz(firstCycleBuzzes[1], secondTeamPlayer, 1, 0);

                    const secondCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[1].buzzes;
                    expect(secondCycleBuzzes.length).to.equal(1);
                    verifyBuzz(secondCycleBuzzes[0], firstTeamPlayers[1], 1, 10);
                    if (match.match_questions[1].bonus == undefined) {
                        assert.fail("Second cycle bonus is undefined");
                    }

                    expect(match.match_questions[1].bonus.question?.question_number).to.equal(1);

                    const thirdCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[2].buzzes;
                    expect(thirdCycleBuzzes.length).to.equal(1);
                    verifyBuzz(thirdCycleBuzzes[0], secondTeamPlayer, 0, 15);
                    if (match.match_questions[2].bonus == undefined) {
                        assert.fail("Third cycle bonus is undefined");
                    }

                    expect(match.match_questions[2].bonus.question?.question_number).to.equal(2);
                }
            );
        });
        it("Four buzzes in paired game (-5, 0, 10, 15)", () => {
            verifyToQBJ(
                (game) => {
                    game.setGameFormat({ ...GameFormats.StandardPowersMACFGameFormat, pairTossupsBonuses: true });

                    game.cycles[0].addWrongBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: -5,
                            position: 0,
                            isLastWord: false,
                        },
                        0,
                        game.gameFormat
                    );
                    game.cycles[0].addWrongBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 0,
                            position: 1,
                            isLastWord: true,
                        },
                        0,
                        game.gameFormat
                    );

                    game.cycles[1].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[1],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );
                    game.cycles[1].setBonusPartAnswer(1, firstTeamPlayers[1].teamName, 10);

                    game.cycles[2].addCorrectBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 15,
                            position: 0,
                            isLastWord: false,
                        },
                        2,
                        game.gameFormat,
                        1,
                        3
                    );
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    const firstCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[0].buzzes;
                    expect(firstCycleBuzzes.length).to.equal(2);
                    verifyBuzz(firstCycleBuzzes[0], firstTeamPlayers[0], 0, -5);
                    verifyBuzz(firstCycleBuzzes[1], secondTeamPlayer, 1, 0);

                    const secondCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[1].buzzes;
                    expect(secondCycleBuzzes.length).to.equal(1);
                    verifyBuzz(secondCycleBuzzes[0], firstTeamPlayers[1], 1, 10);
                    if (match.match_questions[1].bonus == undefined) {
                        assert.fail("Second cycle bonus is undefined");
                    }

                    expect(match.match_questions[1].bonus.question?.question_number).to.equal(2);

                    const thirdCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[2].buzzes;
                    expect(thirdCycleBuzzes.length).to.equal(1);
                    verifyBuzz(thirdCycleBuzzes[0], secondTeamPlayer, 0, 15);
                    if (match.match_questions[2].bonus == undefined) {
                        assert.fail("Third cycle bonus is undefined");
                    }

                    expect(match.match_questions[2].bonus.question?.question_number).to.equal(3);
                }
            );
        });
        it("Bonuses (0, 10, 30)", () => {
            verifyToQBJ(
                (game) => {
                    // 0 on the bonus
                    game.cycles[0].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );

                    // 10
                    game.cycles[1].addCorrectBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        2,
                        game.gameFormat,
                        1,
                        3
                    );
                    game.cycles[1].setBonusPartAnswer(1, secondTeamPlayer.teamName, 10);

                    // 30 on the bonus
                    game.cycles[2].addCorrectBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 15,
                            position: 0,
                            isLastWord: true,
                        },
                        3,
                        game.gameFormat,
                        2,
                        3
                    );
                    for (let i = 0; i < 3; i++) {
                        game.cycles[2].setBonusPartAnswer(i, secondTeamPlayer.teamName, 10);
                    }
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    const firstCycleBonus: QBJ.IMatchQuestionBonus | undefined = match.match_questions[0].bonus;
                    if (firstCycleBonus == undefined) {
                        assert.fail("First bonus wasn't found");
                    }

                    expect(firstCycleBonus.question?.parts).to.equal(3);
                    expect(firstCycleBonus.question?.question_number).to.equal(1);
                    expect(firstCycleBonus.question?.type).to.equal("bonus");
                    expect(firstCycleBonus.parts.map((p) => p.controlled_points)).deep.equals([0, 0, 0]);

                    const secondCycleBonus: QBJ.IMatchQuestionBonus | undefined = match.match_questions[1].bonus;
                    if (secondCycleBonus == undefined) {
                        assert.fail("Second bonus wasn't found");
                    }
                    expect(secondCycleBonus.question?.parts).to.equal(3);
                    expect(secondCycleBonus.question?.question_number).to.equal(2);
                    expect(secondCycleBonus.question?.type).to.equal("bonus");
                    expect(secondCycleBonus.parts.map((p) => p.controlled_points)).deep.equals([0, 10, 0]);

                    const thirdCycleBonus: QBJ.IMatchQuestionBonus | undefined = match.match_questions[2].bonus;
                    if (thirdCycleBonus == undefined) {
                        assert.fail("Third bonus wasn't found");
                    }
                    expect(thirdCycleBonus.question?.parts).to.equal(3);
                    expect(thirdCycleBonus.question?.question_number).to.equal(3);
                    expect(thirdCycleBonus.question?.type).to.equal("bonus");
                    expect(thirdCycleBonus.parts.map((p) => p.controlled_points)).deep.equals([10, 10, 10]);

                    expect(match.match_teams.length).to.equal(2);
                    expect(match.match_teams[0].bonus_points).to.equal(0);
                    expect(match.match_teams[1].bonus_points).to.equal(40);
                }
            );
        });
        it("Bonus bouncebacks", () => {
            verifyToQBJ(
                (game) => {
                    game.setGameFormat({ ...game.gameFormat, bonusesBounceBack: true });

                    // 0 on the bonus
                    game.cycles[0].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );

                    // Receiving team get 10, other team gets 10
                    game.cycles[0].setBonusPartAnswer(0, firstTeamPlayers[0].teamName, 10);
                    game.cycles[0].setBonusPartAnswer(2, secondTeamPlayer.teamName, 10);

                    // Receiving team gets 0, other team gets 20
                    game.cycles[1].addCorrectBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        2,
                        game.gameFormat,
                        1,
                        3
                    );
                    game.cycles[1].setBonusPartAnswer(0, firstTeamPlayers[0].teamName, 10);
                    game.cycles[1].setBonusPartAnswer(1, firstTeamPlayers[0].teamName, 10);
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    const firstCycleBonus: QBJ.IMatchQuestionBonus | undefined = match.match_questions[0].bonus;
                    if (firstCycleBonus == undefined) {
                        assert.fail("First bonus wasn't found");
                    }

                    expect(firstCycleBonus.question?.parts).to.equal(3);
                    expect(firstCycleBonus.question?.question_number).to.equal(1);
                    expect(firstCycleBonus.question?.type).to.equal("bonus");
                    expect(firstCycleBonus.parts.map((p) => p.controlled_points)).deep.equals([10, 0, 0]);
                    expect(firstCycleBonus.parts.map((p) => p.bounceback_points)).deep.equals([0, 0, 10]);

                    const secondCycleBonus: QBJ.IMatchQuestionBonus | undefined = match.match_questions[1].bonus;
                    if (secondCycleBonus == undefined) {
                        assert.fail("Second bonus wasn't found");
                    }
                    expect(secondCycleBonus.question?.parts).to.equal(3);
                    expect(secondCycleBonus.question?.question_number).to.equal(2);
                    expect(secondCycleBonus.question?.type).to.equal("bonus");
                    expect(secondCycleBonus.parts.map((p) => p.controlled_points)).deep.equals([0, 0, 0]);
                    expect(secondCycleBonus.parts.map((p) => p.bounceback_points)).deep.equals([10, 10, 0]);

                    expect(match.match_teams.length).to.equal(2);
                    expect(match.match_teams[0].bonus_points).to.equal(10);
                    expect(match.match_teams[0].bonus_bounceback_points).to.equal(20);
                    expect(match.match_teams[1].bonus_points).to.equal(0);
                    expect(match.match_teams[1].bonus_bounceback_points).to.equal(10);
                }
            );
        });
        it("Sub-in player", () => {
            verifyToQBJ(
                (game) => {
                    game.cycles[1].addSwapSubstitution(firstTeamPlayers[2], firstTeamPlayers[0]);

                    game.cycles[1].addWrongBuzz(
                        {
                            player: firstTeamPlayers[2],
                            points: -5,
                            position: 0,
                            isLastWord: false,
                        },
                        0,
                        game.gameFormat
                    );
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    const secondCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[1].buzzes;
                    expect(secondCycleBuzzes.length).to.equal(1);
                    verifyBuzz(secondCycleBuzzes[0], firstTeamPlayers[2], 0, -5);

                    expect(match.match_teams.length).to.equal(2);
                    expect(match.match_teams[0].match_players.length).to.equal(3);

                    const outFirstTeamPlayer: QBJ.IMatchPlayer = match.match_teams[0].match_players[0];
                    expect(outFirstTeamPlayer.player.name).to.equal(firstTeamPlayers[0].name);
                    expect(outFirstTeamPlayer.tossups_heard).to.equal(1);

                    const inFirstTeamPlayer: QBJ.IMatchPlayer = match.match_teams[0].match_players[2];
                    expect(inFirstTeamPlayer.player.name).to.equal(firstTeamPlayers[2].name);
                    expect(inFirstTeamPlayer.tossups_heard).to.equal(3);

                    // Verify the lineups
                    const firstTeam: QBJ.IMatchTeam = match.match_teams[0];
                    expect(firstTeam.lineups.length).to.equal(2);
                    expect(firstTeam.lineups[0]).to.deep.equal({
                        first_question: 1,
                        players: firstTeamPlayers
                            .filter((p) => p.isStarter)
                            .map((p) => {
                                return { name: p.name };
                            }),
                    });
                    expect(firstTeam.lineups[1]).to.deep.equal({
                        first_question: 2,
                        players: [{ name: "Alan" }, { name: "Anna" }],
                    });
                }
            );
        });
        it("Player leaves", () => {
            verifyToQBJ(
                (game) => {
                    game.cycles[2].addPlayerLeaves(firstTeamPlayers[0]);
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    expect(match.match_teams.length).to.equal(2);
                    expect(match.match_teams[0].match_players.length).to.equal(3);

                    const outFirstTeamPlayer: QBJ.IMatchPlayer = match.match_teams[0].match_players[0];
                    expect(outFirstTeamPlayer.player.name).to.equal(firstTeamPlayers[0].name);
                    expect(outFirstTeamPlayer.tossups_heard).to.equal(2);

                    // Verify the lineups
                    const firstTeam: QBJ.IMatchTeam = match.match_teams[0];
                    expect(firstTeam.lineups.length).to.equal(2);
                    expect(firstTeam.lineups[0]).to.deep.equal({
                        first_question: 1,
                        players: firstTeamPlayers
                            .filter((p) => p.isStarter)
                            .map((p) => {
                                return { name: p.name };
                            }),
                    });
                    expect(firstTeam.lineups[1]).to.deep.equal({
                        first_question: 3,
                        players: [{ name: "Alan" }],
                    });
                }
            );
        });
        it("Player joins", () => {
            const newPlayerName = "Bianca";

            verifyToQBJ(
                (game) => {
                    const newPlayer: Player = new Player(
                        newPlayerName,
                        secondTeamPlayer.teamName,
                        /* isStarter */ false
                    );
                    game.addNewPlayer(newPlayer);
                    game.cycles[3].addPlayerJoins(newPlayer);
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    expect(match.match_teams.length).to.equal(2);
                    expect(match.match_teams[1].match_players.length).to.equal(2);

                    const secondTeam: QBJ.IMatchTeam = match.match_teams[1];
                    const inSecondTeamPlayer: QBJ.IMatchPlayer = secondTeam.match_players[1];
                    expect(inSecondTeamPlayer.player.name).to.equal(newPlayerName);
                    expect(inSecondTeamPlayer.tossups_heard).to.equal(1);

                    // Verify the lineups
                    expect(secondTeam.lineups.length).to.equal(2);
                    expect(secondTeam.lineups[0]).to.deep.equal({
                        first_question: 1,
                        players: [
                            {
                                name: secondTeamPlayer.name,
                            },
                        ],
                    });
                    expect(secondTeam.lineups[1]).to.deep.equal({
                        first_question: 4,
                        players: [{ name: secondTeamPlayer.name }, { name: newPlayerName }],
                    });
                }
            );
        });
        it("Player stats", () => {
            verifyToQBJ(
                (game) => {
                    game.setGameFormat(GameFormats.StandardPowersMACFGameFormat);

                    const packet: PacketState = new PacketState();
                    const tossups: Tossup[] = [];
                    for (let i = 0; i < 6; i++) {
                        tossups.push(new Tossup(`Power (*) question ${i}`, `A${i}`));
                    }

                    packet.setTossups(tossups);
                    game.loadPacket(packet);

                    game.cycles[0].addWrongBuzz(
                        {
                            player: secondTeamPlayer,
                            points: -5,
                            position: 0,
                            isLastWord: false,
                        },
                        0,
                        game.gameFormat
                    );
                    game.cycles[1].addWrongBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 0,
                            position: 3,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat
                    );

                    game.cycles[2].addCorrectBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 10,
                            position: 2,
                            isLastWord: true,
                        },
                        2,
                        game.gameFormat,
                        0,
                        3
                    );

                    game.cycles[3].addCorrectBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 15,
                            position: 0,
                            isLastWord: true,
                        },
                        3,
                        game.gameFormat,
                        1,
                        3
                    );

                    game.cycles[4].addCorrectBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 15,
                            position: 0,
                            isLastWord: false,
                        },
                        4,
                        game.gameFormat,
                        1,
                        3
                    );

                    game.cycles[5].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 2,
                            isLastWord: true,
                        },
                        5,
                        game.gameFormat,
                        1,
                        3
                    );
                },
                (match) => {
                    expect(match.tossups_read).to.equal(6);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4, 5, 6]);

                    expect(match.match_teams.length).to.equal(2);
                    expect(match.match_teams[0].match_players.length).to.equal(3);

                    const firstFirstTeamPlayer: QBJ.IMatchPlayer = match.match_teams[0].match_players[0];
                    expect(firstFirstTeamPlayer.player.name).to.equal(firstTeamPlayers[0].name);
                    expect(firstFirstTeamPlayer.tossups_heard).to.equal(6);
                    expect(firstFirstTeamPlayer.answer_counts.length).to.equal(1);
                    expect(firstFirstTeamPlayer.answer_counts[0]).to.deep.equal({
                        number: 1,
                        answer: {
                            value: 10,
                        },
                    });

                    const lastFirstTeamPlayer: QBJ.IMatchPlayer = match.match_teams[0].match_players[2];
                    expect(lastFirstTeamPlayer.tossups_heard).to.equal(0);
                    expect(lastFirstTeamPlayer.player.name).to.equal(firstTeamPlayers[2].name);

                    expect(match.match_teams[1].match_players.length).to.equal(1);
                    const secondPlayer: QBJ.IMatchPlayer = match.match_teams[1].match_players[0];
                    expect(secondPlayer.player.name).to.equal(secondTeamPlayer.name);
                    expect(secondPlayer.tossups_heard).to.equal(6);
                    // expect(secondPlayer.answer_counts.length).to.equal(4);
                    expect(secondPlayer.answer_counts).to.deep.equal([
                        {
                            number: 1,
                            answer: {
                                value: -5,
                            },
                        },
                        {
                            number: 1,
                            answer: {
                                value: 0,
                            },
                        },
                        {
                            number: 1,
                            answer: {
                                value: 10,
                            },
                        },
                        {
                            number: 2,
                            answer: {
                                value: 15,
                            },
                        },
                    ]);
                }
            );
        });
        it("Tossup protest", () => {
            const firstProtestReason = "First protest";
            const firstProtestAnswer = "First answer";
            const secondProtestReason = "Second protest";
            const secondProtestAnswer = "Second answer";

            verifyToQBJ(
                (game) => {
                    game.cycles[0].addWrongBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: -5,
                            position: 0,
                            isLastWord: false,
                        },
                        0,
                        game.gameFormat
                    );
                    game.cycles[0].addTossupProtest(
                        firstTeamPlayers[0].teamName,
                        0,
                        0,
                        firstProtestAnswer,
                        firstProtestReason
                    );

                    game.cycles[1].addWrongBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 0,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat
                    );
                    game.cycles[1].addTossupProtest(
                        secondTeamPlayer.teamName,
                        1,
                        1,
                        secondProtestAnswer,
                        secondProtestReason
                    );
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    if (match.notes == undefined) {
                        assert.fail("match.notes should be defined.");
                    }

                    const lines: string[] = match.notes.split("\n");
                    expect(lines.length).to.equal(2);
                    expect(lines[0]).to.equal(
                        `Tossup protest on tossup #1. Team "${firstTeamPlayers[0].teamName}" protested because of this reason: "${firstProtestReason}".`
                    );
                    expect(lines[1]).to.equal(
                        `Tossup protest on tossup #2. Team "${secondTeamPlayer.teamName}" protested because of this reason: "${secondProtestReason}".`
                    );
                }
            );
        });
        it("Bonus protest", () => {
            const firstProtestReason = "First protest";
            const firstProtestAnswer = "First answer";
            const secondProtestReason = "Second protest";
            const secondProtestAnswer = "Second answer";

            verifyToQBJ(
                (game) => {
                    game.cycles[0].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 0,
                            isLastWord: false,
                        },
                        0,
                        game.gameFormat,
                        0,
                        3
                    );
                    game.cycles[0].addBonusProtest(
                        0,
                        0,
                        firstProtestAnswer,
                        firstProtestReason,
                        firstTeamPlayers[0].teamName
                    );

                    game.cycles[1].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        1,
                        3
                    );

                    game.cycles[1].setBonusPartAnswer(2, firstTeamPlayers[0].teamName, 10);
                    game.cycles[1].addBonusProtest(
                        1,
                        2,
                        secondProtestAnswer,
                        secondProtestReason,
                        secondTeamPlayer.teamName
                    );
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    if (match.notes == undefined) {
                        assert.fail("match.notes should be defined.");
                    }

                    const lines: string[] = match.notes.split("\n");
                    expect(lines.length).to.equal(2);
                    expect(lines[0]).to.equal(
                        `Bonus protest on bonus #1. Team "${firstTeamPlayers[0].teamName}" protested part 1 because of this reason: "${firstProtestReason}".`
                    );
                    expect(lines[1]).to.equal(
                        `Bonus protest on bonus #2. Team "${secondTeamPlayer.teamName}" protested part 3 because of this reason: "${secondProtestReason}".`
                    );
                }
            );
        });
        it("Thrown out tossup", () => {
            verifyToQBJ(
                (game) => {
                    game.cycles[0].addThrownOutTossup(0);
                    game.cycles[0].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    if (match.notes == undefined) {
                        assert.fail("match.notes should be defined.");
                    }

                    const lines: string[] = match.notes.split("\n");
                    expect(lines.length).to.equal(1);
                    expect(lines[0]).to.equal("Tossup thrown out on question 1");

                    const replacementTossup: QBJ.IQuestion | undefined =
                        match.match_questions[0].replacement_tossup_question;
                    if (replacementTossup == undefined) {
                        assert.fail("Replacement tossup was undefined");
                    }

                    expect(replacementTossup.question_number).to.equal(2);
                    expect(replacementTossup.type).to.equal("tossup");
                }
            );
        });
        it("Thrown out bonus", () => {
            verifyToQBJ(
                (game) => {
                    game.cycles[0].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );
                    game.cycles[0].addThrownOutBonus(0);
                    game.cycles[0].setBonusPartAnswer(0, firstTeamPlayers[0].teamName, 10);
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    if (match.notes == undefined) {
                        assert.fail("match.notes should be defined.");
                    }

                    const lines: string[] = match.notes.split("\n");
                    expect(lines.length).to.equal(1);
                    expect(lines[0]).to.equal("Bonus thrown out on question 1");

                    // TODO: We currently don't set the bonus replacement question, so we'll need to test that once we do

                    if (match.match_questions[0].bonus == undefined) {
                        assert.fail("No bonus on the first question");
                    }

                    expect(match.match_questions[0].bonus.question?.question_number).to.equal(2);
                    expect(match.match_questions[0].bonus.parts.length).to.equal(3);
                    expect(match.match_questions[0].bonus.parts.map((part) => part.controlled_points)).to.deep.equal([
                        10,
                        0,
                        0,
                    ]);
                }
            );
        });
        it("Thrown out bonus in paired game", () => {
            verifyToQBJ(
                (game) => {
                    game.setGameFormat({ ...game.gameFormat, pairTossupsBonuses: true });

                    game.cycles[0].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );
                    game.cycles[0].addThrownOutBonus(0);
                    game.cycles[0].setBonusPartAnswer(0, firstTeamPlayers[0].teamName, 10);
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    if (match.notes == undefined) {
                        assert.fail("match.notes should be defined.");
                    }

                    const lines: string[] = match.notes.split("\n");
                    expect(lines.length).to.equal(1);
                    expect(lines[0]).to.equal("Bonus thrown out on question 1");

                    // TODO: We currently don't set the bonus replacement question, so we'll need to test that once we do

                    if (match.match_questions[0].bonus == undefined) {
                        assert.fail("No bonus on the first question");
                    }

                    // TODO: This behavior seems wrong for paired tossups/bonuses, but we'd have to make some special logic to force
                    // a question to be imported if a bonus was thrown out.
                    expect(match.match_questions[0].bonus.question?.question_number).to.equal(2);
                    expect(match.match_questions[0].bonus.parts.length).to.equal(3);
                    expect(match.match_questions[0].bonus.parts.map((part) => part.controlled_points)).to.deep.equal([
                        10,
                        0,
                        0,
                    ]);
                }
            );
        });
        it("Thrown out bonus on question before correct buzz", () => {
            verifyToQBJ(
                (game) => {
                    game.cycles[0].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );
                    game.cycles[1].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );
                    game.cycles[0].addThrownOutBonus(0);
                    game.cycles[0].setBonusPartAnswer(0, firstTeamPlayers[0].teamName, 10);
                    game.cycles[1].setBonusPartAnswer(1, firstTeamPlayers[0].teamName, 10);
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    if (match.notes == undefined) {
                        assert.fail("match.notes should be defined.");
                    }

                    const lines: string[] = match.notes.split("\n");
                    expect(lines.length).to.equal(1);
                    expect(lines[0]).to.equal("Bonus thrown out on question 1");

                    // TODO: We currently don't set the bonus replacement question, so we'll need to test that once we do

                    const firstQuestion = match.match_questions[0];
                    if (firstQuestion.bonus == undefined) {
                        assert.fail("No bonus on the first question");
                    }

                    expect(firstQuestion.bonus.parts.length).to.equal(3);
                    expect(firstQuestion.bonus.parts.map((part) => part.controlled_points)).to.deep.equal([10, 0, 0]);
                    expect(firstQuestion.bonus.question?.question_number).to.equal(2);

                    const secondQuestion = match.match_questions[1];
                    if (secondQuestion.bonus == undefined) {
                        assert.fail("No bonus on the second question");
                    }

                    expect(secondQuestion.bonus.parts.length).to.equal(3);
                    expect(secondQuestion.bonus.parts.map((part) => part.controlled_points)).to.deep.equal([0, 10, 0]);
                    expect(secondQuestion.bonus.question?.question_number).to.equal(3);
                }
            );
        });
        it("Only exports up to the final question", () => {
            verifyToQBJ(
                (game) => {
                    const newGameFormat: IGameFormat = { ...GameFormats.UndefinedGameFormat, regulationTossupCount: 1 };
                    game.setGameFormat(newGameFormat);

                    game.cycles[0].addCorrectBuzz(
                        {
                            player: firstTeamPlayers[1],
                            points: 10,
                            position: 1,
                            isLastWord: true,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );
                    game.cycles[0].setBonusPartAnswer(1, firstTeamPlayers[1].teamName, 10);
                },
                (match) => {
                    expect(match.tossups_read).to.equal(1);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1]);

                    const cycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[0].buzzes;
                    expect(cycleBuzzes.length).to.equal(1);
                    verifyBuzz(cycleBuzzes[0], firstTeamPlayers[1], 1, 10);
                }
            );
        });
        it("Buzz value changes when game format does", () => {
            verifyToQBJ(
                (game) => {
                    game.clear();
                    game.addNewPlayers(players);

                    const packet: PacketState = new PacketState();
                    packet.setTossups([
                        new Tossup("This is (*) a power", "Answer"),
                        new Tossup("Yet another (*) tossup", "Answer"),
                    ]);
                    game.loadPacket(packet);
                    game.setGameFormat({ ...GameFormats.ACFGameFormat, negValue: 0 });

                    game.cycles[0].addWrongBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 0,
                            position: 2,
                            isLastWord: false,
                        },
                        1,
                        game.gameFormat
                    );

                    game.cycles[1].addCorrectBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 10,
                            position: 1,
                            isLastWord: false,
                        },
                        1,
                        game.gameFormat,
                        0,
                        3
                    );

                    game.setGameFormat(GameFormats.StandardPowersMACFGameFormat);
                },
                (match) => {
                    expect(match.tossups_read).to.equal(2);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2]);

                    const firstCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[0].buzzes;
                    expect(firstCycleBuzzes.length).to.equal(1);
                    verifyBuzz(firstCycleBuzzes[0], firstTeamPlayers[0], 2, -5);

                    const secondCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[1].buzzes;
                    expect(secondCycleBuzzes.length).to.equal(1);
                    verifyBuzz(secondCycleBuzzes[0], secondTeamPlayer, 1, 15);
                }
            );
        });
        it("Neg and no penalty on same word", () => {
            verifyToQBJ(
                (game) => {
                    game.cycles[0].addWrongBuzz(
                        {
                            player: firstTeamPlayers[0],
                            points: 0,
                            position: 0,
                            isLastWord: false,
                        },
                        1,
                        game.gameFormat
                    );

                    game.cycles[0].addWrongBuzz(
                        {
                            player: secondTeamPlayer,
                            points: 0,
                            position: 0,
                            isLastWord: false,
                        },
                        1,
                        game.gameFormat
                    );
                },
                (match) => {
                    expect(match.tossups_read).to.equal(4);
                    expect(match.match_questions.map((q) => q.question_number)).to.deep.equal([1, 2, 3, 4]);

                    const firstCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[0].buzzes;
                    expect(firstCycleBuzzes.length).to.equal(2);
                    verifyBuzz(firstCycleBuzzes[0], firstTeamPlayers[0], 0, -5);
                    verifyBuzz(firstCycleBuzzes[1], secondTeamPlayer, 0, 0);
                }
            );
        });
        it("Packet name in packets field", () => {
            const game: GameState = new GameState();
            game.loadPacket(defaultPacket);
            game.addNewPlayers(players);

            const qbj: string = QBJ.toQBJString(game, "Packet_17.docx");
            expect(qbj).to.not.be.undefined;
            const match: IMatch = JSON.parse(qbj);
            expect(match.packets).to.equal("Packet_17");
        });
        it("Round number in _round field", () => {
            const game: GameState = new GameState();
            game.loadPacket(defaultPacket);
            game.addNewPlayers(players);

            const qbj: string = QBJ.toQBJString(game, "Packet_The_U.docx", 5);
            expect(qbj).to.not.be.undefined;
            const match: IMatch = JSON.parse(qbj);
            expect(match._round).to.equal(5);
        });
    });
    describe("parseRegistration", () => {
        function verifyRegistration(tournament: ITournament, verify: (players: Player[]) => void) {
            const firstResult: IResult<Player[]> = QBJ.parseRegistration(JSON.stringify(tournament));
            if (!firstResult.success) {
                assert.fail("First result should've succeeded");
            }

            verify(firstResult.value);

            const secondResult: IResult<Player[]> = QBJ.parseRegistration(JSON.stringify(tournament.registrations));
            if (!secondResult.success) {
                assert.fail("Second result should've succeeded");
            }

            verify(secondResult.value);
        }

        it("Parse single registration", () => {
            const teamName = "Washington A";
            const tournament: ITournament = {
                name: "Tournament",
                registrations: [
                    {
                        name: "Washington",
                        teams: [
                            {
                                name: teamName,
                                players: [
                                    {
                                        name: "Alice",
                                    },
                                    {
                                        name: "Bob",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            verifyRegistration(tournament, (players) => {
                expect(players.length).to.equal(2);

                const firstPlayer: Player = players[0];
                expect(firstPlayer.name).to.equal("Alice");
                expect(firstPlayer.teamName).to.equal(teamName);
                expect(firstPlayer.isStarter).to.be.true;

                const secondPlayer: Player = players[1];
                expect(secondPlayer.name).to.equal("Bob");
                expect(secondPlayer.teamName).to.equal(teamName);
                expect(secondPlayer.isStarter).to.be.true;
            });
        });
        it("Parse multiple registrations", () => {
            const tournament: ITournament = {
                name: "Tournament",
                registrations: [
                    {
                        name: "Washington",
                        teams: [
                            {
                                name: "Washington A",
                                players: [
                                    {
                                        name: "Alice",
                                    },
                                ],
                            },
                            {
                                name: "Washington B",
                                players: [
                                    {
                                        name: "Bob",
                                    },
                                    {
                                        name: "Betty",
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        name: "Claremont",
                        teams: [
                            {
                                name: "Claremont A",
                                players: [
                                    {
                                        name: "Charlie",
                                    },
                                    {
                                        name: "Carol",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            verifyRegistration(tournament, (players) => {
                expect(players.length).to.equal(5);

                const firstPlayer: Player = players[0];
                expect(firstPlayer.name).to.equal("Alice");
                expect(firstPlayer.teamName).to.equal("Washington A");
                expect(firstPlayer.isStarter).to.be.true;

                const secondPlayer: Player = players[1];
                expect(secondPlayer.name).to.equal("Bob");
                expect(secondPlayer.teamName).to.equal("Washington B");
                expect(secondPlayer.isStarter).to.be.true;

                const thirdPlayer: Player = players[2];
                expect(thirdPlayer.name).to.equal("Betty");
                expect(thirdPlayer.teamName).to.equal("Washington B");
                expect(thirdPlayer.isStarter).to.be.true;

                const fourthPlayer: Player = players[3];
                expect(fourthPlayer.name).to.equal("Charlie");
                expect(fourthPlayer.teamName).to.equal("Claremont A");
                expect(fourthPlayer.isStarter).to.be.true;

                const fifthPlayer: Player = players[4];
                expect(fifthPlayer.name).to.equal("Carol");
                expect(fifthPlayer.teamName).to.equal("Claremont A");
                expect(fifthPlayer.isStarter).to.be.true;
            });
        });

        it("Parse serialized registration", () => {
            const teamName = "Washington A";
            const tournament: QBJ.ISerializedTournament = {
                version: "2.1.1",
                objects: [
                    {
                        type: "Tournament",
                        name: "My Tournament",
                        registrations: [
                            {
                                name: "Washington",
                                teams: [
                                    {
                                        name: teamName,
                                        players: [
                                            {
                                                name: "Alice",
                                            },
                                            {
                                                name: "Bob",
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const playersResult: IResult<Player[]> = QBJ.parseRegistration(JSON.stringify(tournament));
            if (!playersResult.success) {
                assert.fail("First result should've succeeded");
            }

            const players: Player[] = playersResult.value;

            expect(players.length).to.equal(2);

            const firstPlayer: Player = players[0];
            expect(firstPlayer.name).to.equal("Alice");
            expect(firstPlayer.teamName).to.equal(teamName);
            expect(firstPlayer.isStarter).to.be.true;

            const secondPlayer: Player = players[1];
            expect(secondPlayer.name).to.equal("Bob");
            expect(secondPlayer.teamName).to.equal(teamName);
            expect(secondPlayer.isStarter).to.be.true;
        });

        it("Fifth player in registered team isn't a starter", () => {
            const teamName = "Washington A";
            const tournament: ITournament = {
                name: "Tournament",
                registrations: [
                    {
                        name: "Washington",
                        teams: [
                            {
                                name: teamName,
                                players: [
                                    {
                                        name: "Alice",
                                    },
                                    {
                                        name: "Alan",
                                    },
                                    {
                                        name: "Alexandra",
                                    },
                                    {
                                        name: "Arthur",
                                    },
                                    {
                                        name: "Anna",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            verifyRegistration(tournament, (players) => {
                expect(players.length).to.equal(5, `Expected five players in ${players.map((p) => p.name).join(", ")}`);
                for (let i = 0; i < 4; i++) {
                    expect(players[i].isStarter).to.equal(true, `${players[i].name} ($${i}) wasn't a starter`);
                }

                const lastPlayer: Player = players[4];
                expect(lastPlayer.name).to.equal("Anna");
                expect(lastPlayer.teamName).to.equal(teamName);
                expect(lastPlayer.isStarter).to.be.false;
            });
        });

        // These tests are for malformed ITournament instances, so they won't match the type
        /* eslint-disable @typescript-eslint/no-explicit-any */
        it("Registration fails from missing team name", () => {
            const tournament: any = {
                name: "Tournament",
                registrations: [
                    {
                        name: "My tournament",
                        teams: [
                            {
                                players: [
                                    {
                                        name: "Alice",
                                    },
                                    {
                                        name: "Alan",
                                    },
                                    {
                                        name: "Alexandra",
                                    },
                                    {
                                        name: "Arthur",
                                    },
                                    {
                                        name: "Anna",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const json: string = JSON.stringify(tournament);
            expect(QBJ.parseRegistration(json).success).to.be.false;
        });
        it("Registration fails from missing player name", () => {
            const tournament: any = {
                name: "Tournament",
                registrations: [
                    {
                        name: "My tournament",
                        teams: [
                            {
                                name: "Washington",
                                players: [
                                    {},
                                    {
                                        name: "Alexandra",
                                    },
                                    {
                                        name: "Arthur",
                                    },
                                    {
                                        name: "Anna",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const json: string = JSON.stringify(tournament);
            expect(QBJ.parseRegistration(json).success).to.be.false;
        });
        it("Registration fails from missing registrations field", () => {
            const tournament: any = {
                name: "Tournament",
            };

            const json: string = JSON.stringify(tournament);
            expect(QBJ.parseRegistration(json).success).to.be.false;
        });
        it("Registration fails from wrongly typed registrations field", () => {
            const tournament: any = {
                name: "Tournament",
                registrations: "I'm a string",
            };

            const json: string = JSON.stringify(tournament);
            expect(QBJ.parseRegistration(json).success).to.be.false;
        });
        it("Registration fails from having no teams field", () => {
            const tournament: any = {
                name: "Tournament",
                registrations: [
                    {
                        name: "My tournament",
                    },
                ],
            };

            const json: string = JSON.stringify(tournament);
            expect(QBJ.parseRegistration(json).success).to.be.false;
        });
        it("Registration fails from having no teams", () => {
            const tournament: any = {
                name: "Tournament",
                registrations: [
                    {
                        name: "My tournament",
                        teams: [],
                    },
                ],
            };

            const json: string = JSON.stringify(tournament);
            expect(QBJ.parseRegistration(json).success).to.be.false;
        });
        it("Registration fails from having a team with no players", () => {
            const tournament: any = {
                name: "Tournament",
                registrations: [
                    {
                        name: "My tournament",
                        teams: [
                            {
                                name: "Washington",
                                players: [],
                            },
                            {
                                name: "Boise St.",
                                players: [{ name: "Zach" }],
                            },
                        ],
                    },
                ],
            };

            const json: string = JSON.stringify(tournament);
            expect(QBJ.parseRegistration(json).success).to.be.false;
        });
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
});
