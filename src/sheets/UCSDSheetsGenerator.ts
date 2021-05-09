import { Player } from "src/state/TeamState";
import { IRoster, ISheetsGenerator } from "./ISheetsGenerator";
import { IBonusAnswerEvent, ITossupAnswerEvent } from "src/state/Events";
import { Cycle } from "src/state/Cycle";
import { IPlayerToColumnMap } from "./PlayerToColumnMap";

export const UCSDSheetsGenerator: ISheetsGenerator = {
    cyclesLimit: 28,
    firstCycleRow: 4,

    // We can't use team names, since those are filled in with dummy values. Therefore, we have to check the score ranges
    // to make sure that nothing was scored
    overwriteCheckRanges: ["L4:L31", "X4:X31"],
    playerInitialColumns: ["C", "O"],
    playerPerTeamLimit: 6,
    playerRow: 3,
    rostersRange: "Rosters!A1:G",
    writeNoPenaltyBuzzes: false,

    getClearRanges: (sheetName: string): string[] => {
        return [
            // Clear player names and buzzes
            `'${sheetName}'!C3:H31`,
            `'${sheetName}'!O3:T31`,
        ];
    },
    getRosters: (values: gapi.client.sheets.ValueRange): IRoster | undefined => {
        if (values.values == undefined) {
            return undefined;
        }

        // Row of team name + players
        const teamNames: string[] = values.values.map((row) => row[0]);
        const players: Player[] = values.values
            .map<Player[]>((row) => {
                const teamName: string = row[0];
                return row.slice(1).map((playerName, index) => new Player(playerName, teamName, index < 4));
            })
            .reduce((previous, current) => previous.concat(current), []);

        return {
            players,
            teamNames,
        };
    },
    getSheetName,
    getValuesForBonusAnswer: (
        bonusAnswer: IBonusAnswerEvent,
        teamNames: string[],
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[] => {
        const isFirstTeam: boolean = bonusAnswer.receivingTeamName === teamNames[0];
        const startColumn: string = isFirstTeam ? "I" : "U";
        const endColumn: string = isFirstTeam ? "K" : "W";

        const bonusValues: boolean[] = new Array(3).fill(false);
        for (let i = 0; i < 3 && i < bonusAnswer.parts.length; i++) {
            bonusValues[i] = bonusAnswer.parts[i].points > 0;
        }

        return [
            {
                range: `'${sheetName}'!${startColumn}${row}:${endColumn}${row}`,
                values: [bonusValues],
            },
        ];
    },
    getValuesForBonusClear: (sheetName: string): gapi.client.sheets.ValueRange[] => {
        const falses: boolean[][] = [];
        const bonusClearRow: boolean[] = [false, false, false];
        const bonusRowStart = 4;
        const bonusRowEnd = 27;

        for (let i = 8; i <= 27; i++) {
            falses.push(bonusClearRow);
        }

        return [
            {
                range: `'${sheetName}'!I${bonusRowStart}:K${bonusRowEnd}`,
                values: falses,
            },
            {
                range: `'${sheetName}'!U${bonusRowStart}:W${bonusRowEnd}`,
                values: falses,
            },
        ];
    },
    getValuesForBonusProtests: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForBuzzPoints: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForDeadQuestion: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForPlayerJoins: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForPlayerLeaves: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForSubs: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForTeams: (teamNames: string[], sheetName: string): gapi.client.sheets.ValueRange[] => {
        if (teamNames.length !== 2) {
            return [];
        }

        return [
            {
                range: `'${sheetName}'!C1:M1`,
                values: [[teamNames[0]]],
            },
            {
                range: `'${sheetName}'!O1:Y1`,
                values: [[teamNames[1]]],
            },
        ];
    },
    getValuesForCorrectBuzz: (
        buzz: ITossupAnswerEvent,
        points: number,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[] => {
        const column: string | undefined = playerToColumnMapping.get(buzz.marker.player);
        if (column == undefined) {
            return [];
        }

        return [
            {
                range: `'${sheetName}'!${column}${row}`,
                values: [[points]],
            },
        ];
    },
    getValuesForNeg: (
        buzz: ITossupAnswerEvent,
        points: number,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[] => {
        const column: string | undefined = playerToColumnMapping.get(buzz.marker.player);
        if (column == undefined) {
            return [];
        }

        return [
            {
                range: `'${sheetName}'!${column}${row}`,
                values: [[points]],
            },
        ];
    },
    getValuesForTossupProtests: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForStartingLineups: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForTossupsHeard: (
        cycles: Cycle[],
        players: Player[],
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string
    ): gapi.client.sheets.ValueRange[] => {
        // Calculate the tossups heard per player, then put it in the appropriate row
        const playerTossupsHeard: PlayerTossupsHeard[] = players.map((player) => {
            return {
                player,
                isIn: player.isStarter,
                tossupsHeard: 0,
            };
        });

        for (const cycle of cycles) {
            // Order should be leaves, joins, then subs. This should closely match GameState.getActivePlayers

            if (cycle.playerLeaves) {
                for (const leaves of cycle.playerLeaves) {
                    const leavingPlayer: PlayerTossupsHeard | undefined = playerTossupsHeard.find(
                        (player) => player.player === leaves.outPlayer
                    );
                    if (leavingPlayer) {
                        leavingPlayer.isIn = false;
                    }
                }
            }

            if (cycle.playerJoins) {
                for (const joins of cycle.playerJoins) {
                    const joiningPlayer: PlayerTossupsHeard | undefined = playerTossupsHeard.find(
                        (player) => player.player === joins.inPlayer
                    );
                    if (joiningPlayer) {
                        joiningPlayer.isIn = true;
                    }
                }
            }

            if (cycle.subs) {
                for (const sub of cycle.subs) {
                    const inPlayer: PlayerTossupsHeard | undefined = playerTossupsHeard.find(
                        (player) => player.player === sub.inPlayer
                    );
                    if (inPlayer) {
                        inPlayer.isIn = true;
                    }

                    const outPlayer: PlayerTossupsHeard | undefined = playerTossupsHeard.find(
                        (player) => player.player === sub.outPlayer
                    );
                    if (outPlayer) {
                        outPlayer.isIn = false;
                    }
                }
            }

            for (const player of playerTossupsHeard) {
                if (player.isIn) {
                    player.tossupsHeard++;
                }
            }
        }

        // Now that we have the counts, create the ranges
        const valueRanges: gapi.client.sheets.ValueRange[] = [];
        for (const player of playerTossupsHeard) {
            const column: string | undefined = playerToColumnMapping.get(player.player);
            if (column == undefined) {
                continue;
            }

            valueRanges.push({
                range: `'${sheetName}'!${column}32`,
                values: [[player.tossupsHeard]],
            });
        }

        return valueRanges;
    },
    isControlSheet: (values: gapi.client.sheets.ValueRange): boolean => {
        if (values.values == undefined || values.values.length === 0) {
            // The control sheet should have values where we checked
            return false;
        }

        // In UCSD Sheets, the first row is "Team/Player 1/Player 2/..." in the control sheet. This should tell us
        // it's the control sheet, unless someone trolls us (but moving the team to a different row fixes that)
        return (
            values.values[0].length > 2 &&
            values.values[0][0] === "Team" &&
            // The last value might be "Division", so ignore that
            values.values[0].slice(1).findIndex((cell, index) => cell !== `Player ${index + 1}`) <
                values.values[0].length - 1
        );
    },
};

function getSheetName(roundNumber: number): string {
    return `Round ${roundNumber ?? 1}`;
}

interface PlayerTossupsHeard {
    player: Player;
    isIn: boolean;
    tossupsHeard: number;
}
