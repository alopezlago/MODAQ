import { Player } from "../state/TeamState";
import { Cycle } from "../state/Cycle";
import { IBonusAnswerPart, ITossupAnswerEvent } from "../state/Events";
import { GameState } from "../state/GameState";

export function parseRegistration(json: string): Player[] {
    // Either it's a JSON object with "name" or a JSON array
    const parsedInput: IRegistration[] | ITournament = JSON.parse(json);
    let registrations: IRegistration[];
    if (isTournament(parsedInput)) {
        registrations = parsedInput.registrations;
    } else {
        registrations = parsedInput;
    }

    const teamCounts: Map<string, number> = new Map<string, number>();
    const players: Player[] = [];
    for (const registration of registrations) {
        for (const team of registration.teams) {
            for (const player of team.players) {
                let playerCount = teamCounts.get(team.name);
                if (playerCount == undefined) {
                    playerCount = 0;
                }

                playerCount++;
                teamCounts.set(team.name, playerCount);

                // TODO: This should be determined by the format
                players.push(new Player(player.name, team.name, playerCount <= 4));
            }
        }
    }

    return players;
}

// Needed for the type guard
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isTournament(registrations: any): registrations is ITournament {
    return registrations.name != undefined && registrations.registrations != undefined;
}

// Converts games into a QBJ file that conforms to the Match interface in the QB Schema
export function toQBJString(game: GameState, packetName?: string, round?: number): string {
    return JSON.stringify(toQBJ(game, packetName, round));
}

export function toQBJ(game: GameState, packetName?: string, round?: number): IMatch {
    // Convert it to a Match, then use JSON.stringify

    const players: IPlayer[] = [];
    const teams: ITeam[] = game.teamNames.map((name) => {
        return {
            name,
            players: [],
        };
    });

    const teamNames: string[] = game.teamNames;
    const noteworthyEvents: string[] = [];

    // teamLineups tracks the lineup throughout the game, sowe can addd new ones to matchTeams easily
    const teamLineups: Map<string, ILineup> = new Map<string, ILineup>();
    const teamPlayers: Map<string, IPlayer[]> = new Map<string, IPlayer[]>();
    const matchTeams: Map<string, IMatchTeam> = new Map<string, IMatchTeam>();
    for (const teamName of teamNames) {
        const firstLineup: ILineup = {
            first_question: 1,
            players: [],
        };
        teamLineups.set(teamName, firstLineup);
        teamPlayers.set(teamName, []);

        const team: ITeam | undefined = teams.find((t) => t.name === teamName);
        if (team) {
            matchTeams.set(teamName, {
                bonus_points: 0,
                bonus_bounceback_points: game.gameFormat.bonusesBounceBack ? 0 : undefined,
                lineups: [firstLineup],
                match_players: [],
                team,
            });
        }
    }

    for (const player of game.players) {
        const qbjPlayer: IPlayer = {
            name: player.name,
        };

        players.push(qbjPlayer);

        const teamPlayerList: IPlayer[] | undefined = teamPlayers.get(player.teamName);
        if (teamPlayerList) {
            teamPlayerList.push(qbjPlayer);
        }

        if (player.isStarter) {
            const lineup: ILineup | undefined = teamLineups.get(player.teamName);
            if (lineup) {
                lineup.players.push(qbjPlayer);
            }
        }

        const matchTeam: IMatchTeam | undefined = matchTeams.get(player.teamName);
        if (matchTeam) {
            matchTeam.match_players.push({
                player: qbjPlayer,
                answer_counts: [],
                tossups_heard: 0,
            });
            matchTeam.team.players.push(qbjPlayer);
        }
    }

    const matchQuestions: IMatchQuestion[] = [];
    let tossupNumber = 1;
    const teamChangesInCycle: Set<string> = new Set<string>();

    // TODO: Loop until the end of the game, not the number of cycles
    for (let i = 0; i < game.playableCycles.length; i++) {
        const cycle: Cycle = game.playableCycles[i];
        // Seems like this will have a lot of overlap with CycleItemList

        // Ordering of events is
        // Substitutions
        // Buzzes and thrown out tossups, based on the tossup index. If a thrown out tossup and buzz have the same index,
        // prefer the buzz.
        // Thrown out bonuses
        // Bonus Answer
        // TU protests
        // Bonus protests

        // If there's any change in players, we need to update the lineup. We should gather all changes at once, since
        // it only cares about the lineup at a certain time
        if (cycle.playerLeaves || cycle.playerJoins || cycle.subs) {
            teamChangesInCycle.clear();

            if (cycle.playerLeaves) {
                for (const leave of cycle.playerLeaves) {
                    const lineup: ILineup | undefined = teamLineups.get(leave.outPlayer.teamName);
                    if (lineup) {
                        const newLineup: ILineup = {
                            first_question: i + 1,
                            players: lineup.players.filter((player) => player.name !== leave.outPlayer.name),
                        };

                        teamLineups.set(leave.outPlayer.teamName, newLineup);
                        teamChangesInCycle.add(leave.outPlayer.teamName);
                    }
                }
            }

            if (cycle.playerJoins) {
                for (const join of cycle.playerJoins) {
                    const lineup: ILineup | undefined = teamLineups.get(join.inPlayer.teamName);
                    if (lineup) {
                        const newPlayer: IPlayer = { name: join.inPlayer.name };
                        const newLineup: ILineup = {
                            first_question: i + 1,
                            players: lineup.players.concat(newPlayer),
                        };

                        teamLineups.set(join.inPlayer.teamName, newLineup);
                        teamChangesInCycle.add(join.inPlayer.teamName);

                        const matchTeam: IMatchTeam | undefined = matchTeams.get(join.inPlayer.teamName);
                        if (matchTeam != undefined) {
                            const newMatchPlayer: IMatchPlayer = {
                                answer_counts: [],
                                player: newPlayer,
                                tossups_heard: 0,
                            };
                            matchTeam.match_players.push(newMatchPlayer);
                        }
                    }
                }
            }

            if (cycle.subs) {
                for (const sub of cycle.subs) {
                    const lineup: ILineup | undefined = teamLineups.get(sub.inPlayer.teamName);
                    if (lineup) {
                        const newLineup: ILineup = {
                            first_question: i + 1,
                            players: lineup.players
                                .filter((player) => player.name !== sub.outPlayer.name)
                                .concat({ name: sub.inPlayer.name }),
                        };

                        teamLineups.set(sub.inPlayer.teamName, newLineup);
                        teamChangesInCycle.add(sub.inPlayer.teamName);
                    }
                }
            }

            for (const teamName of teamChangesInCycle.values()) {
                const matchTeam: IMatchTeam | undefined = matchTeams.get(teamName);
                const newLineup: ILineup | undefined = teamLineups.get(teamName);
                if (matchTeam != undefined && newLineup != undefined) {
                    matchTeam.lineups.push(newLineup);
                }
            }
        }

        // Update the TUH of all the players after we've calculated this cycle's lineup
        // We could do this later based on the lineups in the matchTeam, but this way is much easier to calculate
        // The number of players on a team and in the lineups should be small, so this quadratic approach should be
        // fine (and likely faster than using a map each time)
        for (const matchTeam of matchTeams.values()) {
            const lineup: ILineup | undefined = teamLineups.get(matchTeam.team.name);
            if (lineup) {
                for (const player of matchTeam.match_players) {
                    if (lineup.players.some((p) => p.name === player.player.name)) {
                        player.tossups_heard++;
                    }
                }
            }
        }

        let replacementTossup: IQuestion | undefined = undefined;
        if (cycle.thrownOutTossups) {
            for (const thrownOutTossup of cycle.thrownOutTossups) {
                noteworthyEvents.push(`Tossup thrown out on question ${thrownOutTossup.questionIndex + 1}`);
                tossupNumber++;
                replacementTossup = {
                    parts: 1,
                    question_number: tossupNumber,
                    type: "tossup",
                };
            }
        }

        if (cycle.thrownOutBonuses) {
            for (const thrownOutBonus of cycle.thrownOutBonuses) {
                // TODO: Unclear on how thrown out bonuses should be handled, since the replacement_bonus is just the
                // bonus right now. Just add an event for now
                noteworthyEvents.push(`Bonus thrown out on question ${thrownOutBonus.questionIndex + 1}`);
            }
        }

        // We have to track tu/bonus question numbers
        const matchQuestion: IMatchQuestion = {
            buzzes: [],
            question_number: i + 1,
            tossup_question: {
                parts: 1,
                type: "tossup",
                question_number: tossupNumber,
            },
            replacement_tossup_question: replacementTossup,
            // TODO: Figure out how to set replacement_bonus. Doesn't really make sense right now, since it seems to be
            // the same as bonus
            bonus: undefined,
        };

        let isFirstBuzz = true;
        for (const buzz of cycle.orderedBuzzes) {
            const matchBuzz: IMatchQuestionBuzz | undefined = getBuzz(game, teams, buzz, isFirstBuzz);
            if (matchBuzz != undefined) {
                matchQuestion.buzzes.push(matchBuzz);
                updateAnswerCount(matchTeams, matchBuzz);
            }

            isFirstBuzz = false;
        }

        if (cycle.correctBuzz && cycle.bonusAnswer) {
            const matchTeam: IMatchTeam | undefined = matchTeams.get(cycle.bonusAnswer.receivingTeamName);
            const otherTeam: IMatchTeam | undefined = [...matchTeams.values()].find((team) => team !== matchTeam);

            const parts: IMatchQuestionBonusPart[] = [];
            for (let j = 0; j < cycle.bonusAnswer.parts.length; j++) {
                const bonusAnswerPart: IBonusAnswerPart | undefined =
                    cycle.bonusAnswer.parts && cycle.bonusAnswer.parts[j];
                const points: number = bonusAnswerPart ? bonusAnswerPart.points : 0;
                const matchPart: IMatchQuestionBonusPart = {
                    controlled_points: 0,
                };

                if (
                    matchTeam != undefined &&
                    (bonusAnswerPart == undefined ||
                        bonusAnswerPart.teamName === cycle.correctBuzz.marker.player.teamName)
                ) {
                    matchPart.controlled_points = points;
                    matchPart.bounceback_points = game.gameFormat.bonusesBounceBack ? 0 : undefined;
                    matchTeam.bonus_points += points;
                } else if (otherTeam != undefined) {
                    matchPart.bounceback_points = points;
                    if (otherTeam.bonus_bounceback_points != undefined) {
                        otherTeam.bonus_bounceback_points += points;
                    }
                }

                parts.push(matchPart);
            }

            const matchBonus: IMatchQuestionBonus = {
                question: {
                    parts: cycle.bonusAnswer.parts.length,
                    type: "bonus",
                    question_number: cycle.bonusAnswer.bonusIndex + 1,
                },
                parts,
            };
            matchQuestion.bonus = matchBonus;
        }

        if (cycle.tossupProtests) {
            for (const protest of cycle.tossupProtests) {
                noteworthyEvents.push(
                    `Tossup protest on question ${protest.questionIndex + 1}. Team "${
                        protest.teamName
                    }" protested because of this reason: "${protest.reason}".`
                );
            }
        }

        if (cycle.bonusProtests) {
            for (const protest of cycle.bonusProtests) {
                noteworthyEvents.push(
                    `Bonus protest on question ${protest.questionIndex + 1}. Team "${
                        protest.teamName
                    }" protested part ${protest.partIndex + 1} because of this reason: "${protest.reason}".`
                );
            }
        }

        // Next cycle always begins with the next tossup
        matchQuestions.push(matchQuestion);
        tossupNumber++;
    }

    const match: IMatch = {
        // TODO: This should take the format into account, based on how long regular matches should be, plus overtimes
        tossups_read: game.playableCycles.length,
        match_teams: [...matchTeams.values()],
        match_questions: matchQuestions,
        notes: noteworthyEvents.length > 0 ? noteworthyEvents.join("\n") : undefined,
        _round: round,
    };

    if (packetName) {
        const lastDotIndex: number = packetName.lastIndexOf(".");
        if (lastDotIndex > 0) {
            // Strip out the . to get the packet name
            packetName = packetName.substring(0, lastDotIndex);
        }

        match.packets = packetName;
    }

    return match;
}

function getBuzz(
    game: GameState,
    teams: ITeam[],
    buzz: ITossupAnswerEvent,
    isFirstBuzz: boolean
): IMatchQuestionBuzz | undefined {
    const team: ITeam | undefined = teams.find((team) => team.name === buzz.marker.player.teamName);

    // Negs only happen on the first incorrect buzz (for now), so reset the value to 0 if they were wrong
    let buzzPoints: number = game.getBuzzValue(buzz);
    if (buzzPoints === game.gameFormat.negValue && !isFirstBuzz) {
        // TODO: This should probably come from a game format setting. For now, if it's not the first wrong answer, it's
        //  not a neg. Reset its value to 0.
        buzzPoints = 0;
    }

    return (
        team && {
            buzz_position: {
                word_index: buzz.marker.position,
            },
            player: { name: buzz.marker.player.name },
            team,
            result: { value: buzzPoints },
        }
    );
}

function updateAnswerCount(matchTeams: Map<string, IMatchTeam>, buzz: IMatchQuestionBuzz): void {
    const matchTeam: IMatchTeam | undefined = matchTeams.get(buzz.team.name);

    if (matchTeam == undefined) {
        return;
    }

    const player: IMatchPlayer | undefined = matchTeam.match_players.find(
        (matchPlayer) => matchPlayer.player.name === buzz.player.name
    );

    if (player == undefined) {
        return;
    }

    const points: number = buzz.result.value;
    let answerCount: IPlayerAnswerCount | undefined = player.answer_counts.find(
        (answer) => answer.answer.value === points
    );
    if (answerCount == undefined) {
        answerCount = {
            answer: {
                value: points,
            },
            number: 0,
        };
        player.answer_counts.push(answerCount);
    }

    answerCount.number++;
}

// Adapted from https://schema.quizbowl.technology/match
export interface IMatch {
    tossups_read: number;
    overtime_tossups_read?: number; //(leave empty for now, until formats are more integrated)
    match_teams: IMatchTeam[];
    match_questions: IMatchQuestion[];
    notes?: string; // For storing protest info and thrown out Qs
    packets?: string; // The name of the packet

    _round?: number; // This isn't in the QBJ spec, but is useful for MODAQ since some of its use cases are for reading one game at a time
}

export interface ITeam {
    name: string;
    players: IPlayer[];
}

export interface IPlayer {
    name: string;
}

export interface IMatchTeam {
    team: ITeam;
    bonus_points: number;
    bonus_bounceback_points?: number;
    match_players: IMatchPlayer[];
    lineups: ILineup[]; // Lineups seen. New entries happen when there are changes in the lineup
}

export interface IMatchPlayer {
    player: IPlayer;
    tossups_heard: number;
    answer_counts: IPlayerAnswerCount[];
}

export interface IPlayerAnswerCount {
    number: number;
    answer: IAnswerType;
}

export interface ILineup {
    first_question: number; // Which question number this lineup heard first
    players: IPlayer[];
    // could eventually do reason if we have formats restrict when subs occur
}

export interface IAnswerType {
    value: number; // # of points
    // Could include label for neg/no penalty/get/power/etc.
}

export interface IMatchQuestion {
    question_number: number; // The cycle, starts at 1
    tossup_question: IQuestion;
    replacement_tossup_question?: IQuestion; // multiple replacement tossups not currently supported
    buzzes: IMatchQuestionBuzz[];
    bonus?: IMatchQuestionBonus;
    replacement_bonus?: IMatchQuestionBonus; // multiple replacements not currently supported
}

export interface IQuestion {
    question_number: number; // number of question in packet
    type: "tossup" | "bonus" | "lightning";
    parts: number; // 1 for tossup, n for bonuses
}

export interface IMatchQuestionBuzz {
    team: ITeam;
    player: IPlayer;
    buzz_position: IBuzzPosition;
    result: IAnswerType;
}

export interface IBuzzPosition {
    word_index: number; // 0-indexed
}

export interface IMatchQuestionBonus {
    question?: IQuestion;
    parts: IMatchQuestionBonusPart[];
}

export interface IMatchQuestionBonusPart {
    controlled_points: number;
    bounceback_points?: number;
}

// Follow https://schema.quizbowl.technology/tournament
export interface ITournament {
    name: string;
    registrations: IRegistration[];
}

export interface IRegistration {
    name: string;
    teams: ITeam[];
}
