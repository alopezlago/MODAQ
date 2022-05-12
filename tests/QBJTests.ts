import { assert, expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import * as QBJ from "src/qbj/QBJ";
import { IMatch } from "src/qbj/QBJ";
import { GameState } from "src/state/GameState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";
import { IGameFormat } from "src/state/IGameFormat";

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

function verifyBuzz(buzz: QBJ.IMatchQuestionBuzz, player: Player, position: number, points: number): void {
    expect(buzz.buzz_position.word_index).to.equal(position);
    expect(buzz.team.name).to.equal(player.teamName);
    expect(buzz.player.name).to.equal(player.name);
    expect(buzz.result.value).to.equal(points);
}

function verifyQBJ(updateGame: (game: GameState) => void, verifyMatch: (match: IMatch, game: GameState) => void): void {
    const game: GameState = new GameState();
    game.loadPacket(defaultPacket);
    game.addPlayers(players);
    updateGame(game);

    const qbj: string = QBJ.toQBJString(game);
    expect(qbj).to.not.be.undefined;
    const match: IMatch = JSON.parse(qbj);
    verifyMatch(match, game);
}

describe("QBJTests", () => {
    describe("ToQBJ", () => {
        it("No buzz game", () => {
            verifyQBJ(
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
            verifyQBJ(
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

                    const thirdCycleBuzzes: QBJ.IMatchQuestionBuzz[] = match.match_questions[2].buzzes;
                    expect(thirdCycleBuzzes.length).to.equal(1);
                    verifyBuzz(thirdCycleBuzzes[0], secondTeamPlayer, 0, 15);
                }
            );
        });
        it("Bonuses (0, 10, 30)", () => {
            verifyQBJ(
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
            verifyQBJ(
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
            verifyQBJ(
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
            verifyQBJ(
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

            verifyQBJ(
                (game) => {
                    game.cycles[3].addPlayerJoins(
                        new Player(newPlayerName, secondTeamPlayer.teamName, /* isStarter */ false)
                    );
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
            verifyQBJ(
                (game) => {
                    game.setGameFormat(GameFormats.StandardPowersMACFGameFormat);

                    const packet: PacketState = new PacketState();
                    const tossups: Tossup[] = [];
                    for (let i = 0; i < 6; i++) {
                        tossups.push(new Tossup(`Power (*) question ${i}`, `A${i}`));
                    }

                    packet.setTossups(tossups);
                    game.loadPacket(packet);
                    console.log("Packet length: " + game.packet.tossups.length);

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

            verifyQBJ(
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
                        `Tossup protest on question 1. Team "${firstTeamPlayers[0].teamName}" protested because of this reason: "${firstProtestReason}".`
                    );
                    expect(lines[1]).to.equal(
                        `Tossup protest on question 2. Team "${secondTeamPlayer.teamName}" protested because of this reason: "${secondProtestReason}".`
                    );
                }
            );
        });
        it("Bonus protest", () => {
            const firstProtestReason = "First protest";
            const firstProtestAnswer = "First answer";
            const secondProtestReason = "Second protest";
            const secondProtestAnswer = "Second answer";

            verifyQBJ(
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
                        `Bonus protest on question 1. Team "${firstTeamPlayers[0].teamName}" protested part 1 because of this reason: "${firstProtestReason}".`
                    );
                    expect(lines[1]).to.equal(
                        `Bonus protest on question 2. Team "${secondTeamPlayer.teamName}" protested part 3 because of this reason: "${secondProtestReason}".`
                    );
                }
            );
        });
        it("Thrown out tossup", () => {
            verifyQBJ(
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
            verifyQBJ(
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

                    expect(match.match_questions[0].bonus.parts.length).to.equal(3);
                    expect(match.match_questions[0].bonus.parts.map((part) => part.controlled_points)).to.deep.equal([
                        10,
                        0,
                        0,
                    ]);
                }
            );
        });
        it("Only exports up to the final question", () => {
            verifyQBJ(
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
            verifyQBJ(
                (game) => {
                    game.clear();
                    game.addPlayers(players);

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
            verifyQBJ(
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
            game.addPlayers(players);

            const qbj: string = QBJ.toQBJString(game, "Packet_17.docx");
            expect(qbj).to.not.be.undefined;
            const match: IMatch = JSON.parse(qbj);
            expect(match.packets).to.equal("Packet_17");
        });
    });
});
