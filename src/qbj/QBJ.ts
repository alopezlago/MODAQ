import * as FormattedTextParser from "../parser/FormattedTextParser";
import { Player } from "../state/TeamState";
import { Cycle } from "../state/Cycle";
import { IBonusAnswerPart, ITossupAnswerEvent } from "../state/Events";
import { GameState } from "../state/GameState";
import { PacketState } from "../state/PacketState";
import { IResult } from "../IResult";
import { IGameFormat } from "../state/IGameFormat";
import { IBuzzMarker } from "../state/IBuzzMarker";

export function parseRegistration(json: string): IResult<Player[]> {
    // Either it's a serialized tournament with an objects and version field, a JSON object with "name" or a JSON array
    const parsedInput: IRegistration[] | ITournament | ISerializedTournament = JSON.parse(json);
    let registrations: IRegistration[];
    if (isTournament(parsedInput)) {
        registrations = parsedInput.registrations;
    } else if (isSerializedTournament(parsedInput)) {
        const serializedTournament: ISerializedTournamentObject | undefined = parsedInput.objects.find((object) =>
            isTournament(object)
        );
        if (serializedTournament == undefined) {
            return {
                success: false,
                message: "Objects doesn't have a valid Tournament in it.",
            };
        }

        registrations = serializedTournament.registrations;
    } else {
        registrations = parsedInput;
    }

    if (!Array.isArray(registrations)) {
        return {
            success: false,
            message: "No list of registrations found in the file.",
        };
    }

    const teamCounts: Map<string, number> = new Map<string, number>();
    const players: Player[] = [];
    for (const registration of registrations) {
        if (registration.teams == undefined || !Array.isArray(registration.teams)) {
            return {
                success: false,
                message: "Registration is missing a teams field.",
            };
        }

        for (const team of registration.teams) {
            if (team.name == undefined) {
                return {
                    success: false,
                    message: `Registration is either missing a team name or has a null value for the team name.`,
                };
            } else if (team.players == undefined) {
                return {
                    success: false,
                    message: `Registration is missing a players field for team '${team.name}'.`,
                };
            } else if (!Array.isArray(team.players) || team.players.length === 0) {
                return {
                    success: false,
                    message: `Registration has an empty or incorrect players field for team '${team.name}'.`,
                };
            }

            for (const player of team.players) {
                if (player.name == undefined) {
                    return {
                        success: false,
                        message: `Registration has a player with no name on team '${team.name}'.`,
                    };
                }

                let playerCount = teamCounts.get(team.name);
                if (playerCount == undefined) {
                    playerCount = 0;
                }

                playerCount++;
                teamCounts.set(team.name, playerCount);

                // TODO: The isStarter value should be determined by the format
                players.push(new Player(player.name, team.name, playerCount <= 4));
            }
        }
    }

    if (players.length === 0) {
        return {
            success: false,
            message: "Registration has no players",
        };
    }

    return { success: true, value: players };
}

// Needed for the type guard
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSerializedTournament(parsedJson: any): parsedJson is ISerializedTournament {
    if (parsedJson.version == undefined || parsedJson.objects == undefined) {
        return false;
    }

    // Needed for the type guard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objects: any[] = parsedJson.objects;

    if (!Array.isArray(objects)) {
        return false;
    }

    return objects.some((object) => object.type === "Tournament" && isTournament(object));
}

// Needed for the type guard
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isTournament(registrations: any): registrations is ITournament {
    return (
        registrations.name != undefined &&
        registrations.registrations != undefined &&
        Array.isArray(registrations.registrations)
    );
}

export function fromQBJ(qbj: IMatch, packet: PacketState, gameFormat: IGameFormat): IResult<GameState> {
    if (qbj == undefined) {
        return {
            success: false,
            message: "No QBJ file loaded",
        };
    }

    const gameState: GameState = new GameState();
    gameState.loadPacket(packet);
    gameState.setGameFormat(gameFormat);

    if (qbj.match_teams == undefined) {
        return {
            success: false,
            message: "No match teams found in the QBJ file",
        };
    } else if (qbj.match_teams.length !== 2) {
        return {
            success: false,
            message: "There must be 2 teams in the QBJ file",
        };
    }

    // We'll only have two entries, so we don't really need a set
    const teamNames: string[] = [];
    const players: Player[] = [];
    const playerMap: Map<string, Player> = new Map<string, Player>();
    for (let i = 0; i < qbj.match_teams.length; i++) {
        const matchTeam: IMatchTeam = qbj.match_teams[i];
        const teamName: string | undefined = matchTeam.team?.name;
        if (teamName == undefined || teamName.trim() === "") {
            return {
                success: false,
                message: `Team #${i + 1} has no match team name`,
            };
        }

        if (teamNames.includes(teamName.trim())) {
            return {
                success: false,
                message: `Team names are the same`,
            };
        }

        teamNames.push(teamName.trim());

        if (matchTeam.match_players == undefined || matchTeam.match_players.length === 0) {
            return {
                success: false,
                message: `Team #${teamName} has no match players`,
            };
        }

        if (matchTeam.bonus_points < 0) {
            return {
                success: false,
                message: `Team #${teamName} has negative bonus points`,
            };
        }

        if (matchTeam.lineups == undefined || matchTeam.lineups.length === 0) {
            return {
                success: false,
                message: `Team ${teamName} has no lineup`,
            };
        }

        const firstLineup: ILineup = matchTeam.lineups[0];
        if (firstLineup == undefined) {
            return {
                success: false,
                message: `No lineup found for team '${teamName}'`,
            };
        }

        for (let i = 0; i < matchTeam.match_players.length; i++) {
            // Need to determine which players are starters when we create the Player object
            // Lineups should be small, and this should be run from the client-side, so just look through the array
            // each time instead of converting it to a Set first
            const matchPlayer: IMatchPlayer = matchTeam.match_players[i];
            const isStarter: boolean = firstLineup.players.some((p) => p.name === matchPlayer.player.name);
            const playerName: string | undefined = matchPlayer.player?.name;
            if (playerName == undefined || playerName.trim() === "") {
                return {
                    success: false,
                    message: `Player #${i + 1} on team '${teamName}' has no name`,
                };
            }

            const player: Player = new Player(playerName, teamName, isStarter);

            players.push(player);

            const mapSize: number = playerMap.size;
            playerMap.set(`${player.teamName};${player.name}`, player);

            if (mapSize === playerMap.size) {
                return {
                    success: false,
                    message: `Duplicate player '${player.name}' on team on team '${player.teamName}'. Teams must have unique player names`,
                };
            }
        }

        let lineupsQuestion: number = firstLineup.first_question;
        const previousLineupPlayersResult: IResult<Set<Player>> = getPlayerSetFromLineup(
            firstLineup,
            matchTeam.team.name,
            playerMap
        );
        if (!previousLineupPlayersResult.success) {
            return previousLineupPlayersResult;
        }

        const previousLineupPlayers: Set<Player> = previousLineupPlayersResult.value;
        for (let i = 1; i < matchTeam.lineups.length; i++) {
            const newLineup: ILineup = matchTeam.lineups[i];

            // Verify that first_question is monotonically increasing
            if (newLineup.first_question < 0 || newLineup.first_question >= gameState.cycles.length) {
                return {
                    success: false,
                    message: `Lineup #${i + 1} for team ${teamName} happens at an invalid time (question #${
                        newLineup.first_question
                    })`,
                };
            }

            if (lineupsQuestion >= newLineup.first_question) {
                return {
                    success: false,
                    message: `Lineup #${i + 1} for team ${teamName} happens before the previous lineup (question #${
                        newLineup.first_question
                    } is before question #${lineupsQuestion})`,
                };
            }

            lineupsQuestion = newLineup.first_question;

            const cycle: Cycle = gameState.cycles[newLineup.first_question];
            const newLineupPlayersResult: IResult<Set<Player>> = getPlayerSetFromLineup(
                newLineup,
                matchTeam.team.name,
                playerMap
            );

            if (!newLineupPlayersResult.success) {
                return newLineupPlayersResult;
            }

            const newLineupPlayers: Set<Player> = newLineupPlayersResult.value;

            // QBJ doesn't give us enough information to determine if a player was subbed or not, so simplify it and
            // just treat it as join/leave events.

            // Left
            const leftPlayers: Player[] = [...previousLineupPlayers.values()].filter(
                (player) => !newLineupPlayers.has(player)
            );
            for (const leftPlayer of leftPlayers) {
                cycle.addPlayerLeaves(leftPlayer);
            }

            // Joined
            const joinedPlayers: Player[] = [...newLineupPlayers.values()].filter(
                (player) => !previousLineupPlayers.has(player)
            );
            for (const joinedPlayer of joinedPlayers) {
                cycle.addPlayerJoins(joinedPlayer);
            }
        }
    }

    gameState.addNewPlayers(players);

    if (qbj.match_questions == undefined || qbj.match_questions.length === 0) {
        return {
            success: false,
            message: "No match questions found in the QBJ file",
        };
    }

    let previousTossupIndex = -1;
    let previousBonusIndex = -1;
    for (let i = 0; i < qbj.match_questions.length && i < packet.tossups.length; i++) {
        const question = qbj.match_questions[i];
        const cycle: Cycle = gameState.cycles[i];
        let latestBonusIndex: number = previousBonusIndex + 1;
        let latestTossupIndex: number = previousTossupIndex + 1;

        // The correct buzz needs to be added after throwing out any tossups, so we have to delay adding it to the cycle
        let addCorrectBuzzEvent: undefined | (() => void);

        let correctTeamName: string | undefined;
        let correctTossupIndex = -1;

        const tossupLength: number = FormattedTextParser.splitFormattedTextIntoWords(packet.tossups[i].question).length;
        const buzzesCount: number = question.buzzes?.length ?? 0;

        // Update the cycles in this order. Using a different order can result in conflicts. For example, throwing
        // out a tossup will clear any correct buzzes.
        // - Incorrect buzzes
        // - Thrown out tossups
        // - Correct buzz
        // - Thrown out bonuses
        // - Bonus part answers

        for (let j = 0; j < buzzesCount; j++) {
            const buzz: IMatchQuestionBuzz = question.buzzes[j];
            if (buzz.player == undefined) {
                return { success: false, message: `No player for buzz #${j + 1} in question #${i + 1}` };
            }

            // Need to do a lot of lookups here (player -> player)
            const player: Player | undefined = playerMap.get(`${buzz.team.name};${buzz.player.name}`);

            if (player == undefined) {
                return {
                    success: false,
                    message: `Failed to load cycle ${i + 1}: couldn't find player with name "${
                        buzz.player.name
                    }" on team "${buzz.team.name}"`,
                };
            }

            const position: number = buzz.buzz_position.word_index;
            if (position < 0) {
                return {
                    success: false,
                    message: `Buzz on cycle ${i + 1} by player "${buzz.player.name}" on team "${
                        buzz.team.name
                    }" has a negative buzz position`,
                };
            } else if (position > tossupLength + 1) {
                return {
                    success: false,
                    message: `Buzz on cycle ${i + 1} by player "${buzz.player.name}" on team "${
                        buzz.team.name
                    }" is larger than the number of words in the question`,
                };
            }

            // isLastWord is only set for incorrect buzzes
            const buzzMarker: IBuzzMarker = {
                player: player,
                points: buzz.result.value,
                position: buzz.buzz_position.word_index,
            };

            if (buzzMarker.points <= 0) {
                buzzMarker.isLastWord = buzz.buzz_position.word_index >= tossupLength - 1;
            }

            const tossupIndex: number = question.tossup_question.question_number - 1;
            latestTossupIndex = Math.max(tossupIndex, latestTossupIndex);

            if (buzz.result.value > 0) {
                let bonusQuestionNumber: number | undefined;
                let bonusQuestionPartsLength: number | undefined;
                if (question.bonus && question.bonus.question) {
                    bonusQuestionNumber = question.bonus.question.question_number - 1;
                    bonusQuestionPartsLength = question.bonus.parts.length;
                }

                correctTeamName = buzz.team.name;
                correctTossupIndex = tossupIndex;
                latestBonusIndex = bonusQuestionNumber ?? previousBonusIndex;

                addCorrectBuzzEvent = () =>
                    cycle.addCorrectBuzz(
                        buzzMarker,
                        tossupIndex,
                        gameFormat,
                        bonusQuestionNumber,
                        bonusQuestionPartsLength
                    );
            } else {
                cycle.addWrongBuzz(buzzMarker, tossupIndex, gameFormat);
            }
        }

        if (correctTossupIndex >= 0 && correctTossupIndex !== latestTossupIndex) {
            return {
                success: false,
                message: `Correct tossup index didn't match the latest tossup in all of the buzzes in cycle ${i + 1}`,
            };
        }

        for (let j = previousTossupIndex + 1; j < latestTossupIndex; j++) {
            // We must have thrown out the other questions
            cycle.addThrownOutTossup(j);
        }

        if (addCorrectBuzzEvent) {
            addCorrectBuzzEvent();
        }

        for (let j = previousBonusIndex + 1; j < latestBonusIndex; j++) {
            cycle.addThrownOutBonus(j);
        }

        if (question.bonus && question.bonus.question && question.bonus.parts && correctTeamName) {
            for (let j = 0; j < question.bonus.parts.length; j++) {
                const part = question.bonus.parts[j];

                // To match the current behavior, only set the part if someone scored
                if (part.controlled_points == 0) {
                    continue;
                }

                cycle.setBonusPartAnswer(j, correctTeamName, part.controlled_points);

                // We can add support later, but bouncebacks are rare, and the logic is trickier if we have to hanlde
                // multi-team scenarios
                if (part.bounceback_points && part.bounceback_points > 0) {
                    return {
                        success: false,
                        message: `QBJ files with bouncebacks are currently unsupported. Bounceback found in cycle ${
                            i + 1
                        }`,
                    };
                }
            }
        }

        previousTossupIndex = latestTossupIndex;
        previousBonusIndex = latestBonusIndex;
    }

    return {
        success: true,
        value: gameState,
    };
}

// Converts games into a QBJ file that conforms to the Match interface in the QB Schema
export function toQBJString(game: GameState, packetName?: string, round?: number): string {
    // Pretty-print with a width of 2. This makes games a lot more readable, but not too much bigger than normal.
    return JSON.stringify(toQBJ(game, packetName, round), null, 2);
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
    let bonusNumber = 1;
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
                bonusNumber++;
            }
        }

        // We have to track tu/bonus question numbers
        const matchQuestion: IMatchQuestion = {
            question_number: i + 1,
            buzzes: [],
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
                    question_number: bonusNumber,
                },
                parts,
            };
            matchQuestion.bonus = matchBonus;

            bonusNumber++;
        }

        if (!cycle.correctBuzz && game.gameFormat.pairTossupsBonuses) {
            // We move to the next bonus regardless if we're pairing tossups and bonuses
            bonusNumber++;
        }

        if (cycle.tossupProtests) {
            for (const protest of cycle.tossupProtests) {
                noteworthyEvents.push(
                    `Tossup protest on tossup #${protest.questionIndex + 1}. Team "${
                        protest.teamName
                    }" protested because of this reason: "${protest.reason}".`
                );
            }
        }

        if (cycle.bonusProtests) {
            for (const protest of cycle.bonusProtests) {
                noteworthyEvents.push(
                    `Bonus protest on bonus #${protest.questionIndex + 1}. Team "${protest.teamName}" protested part ${
                        protest.partIndex + 1
                    } because of this reason: "${protest.reason}".`
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

function getPlayerSetFromLineup(
    lineup: ILineup,
    teamName: string,
    playerMap: Map<string, Player>
): IResult<Set<Player>> {
    if (lineup.players == undefined) {
        return {
            success: false,
            message: "No players defined in lineup",
        };
    }

    const playerSet: Set<Player> = new Set<Player>();
    for (let i = 0; i < lineup.players.length; i++) {
        const lineupPlayer: IPlayer = lineup.players[i];
        if (lineupPlayer == undefined) {
            return {
                success: false,
                message: `Player #${i} in lineup is null`,
            };
        }

        const player: Player | undefined = playerMap.get(`${teamName};${lineupPlayer.name}`);
        if (player == undefined) {
            return {
                success: false,
                message: `Couldn't find player '${lineupPlayer.name}' in team '${teamName}'`,
            };
        }

        const playerSetSize: number = playerSet.size;
        playerSet.add(player);

        if (playerSet.size === playerSetSize) {
            return {
                success: false,
                message: `Duplicate player in lineup for team '${teamName}': '${lineupPlayer.name}'`,
            };
        }
    }

    return { success: true, value: playerSet };
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

// Follow https://schema.quizbowl.technology/serialization/
export interface ISerializedTournament {
    version: string;
    objects: ISerializedTournamentObject[];
}

export type ISerializedTournamentObject = ITournament & { type: "Tournament" };

// Follow https://schema.quizbowl.technology/tournament
export interface ITournament {
    name: string;
    registrations: IRegistration[];
}

export interface IRegistration {
    name: string;
    teams: ITeam[];
}
