import { Player } from "src/state/TeamState";
import { IRoster, ISheetsGenerator } from "./ISheetsGenerator";
import {
    IBonusAnswerEvent,
    IPlayerJoinsEvent,
    IPlayerLeavesEvent,
    ISubstitutionEvent,
    ITossupAnswerEvent,
} from "src/state/Events";
import { IPlayerToColumnMap } from "./PlayerToColumnMap";

const playerRow = 3;
const firstCycleRow = 4;
const subInRow = 28;
const subOutRow = 29;

export const TJSheetsGenerator: ISheetsGenerator = {
    cyclesLimit: 24,
    firstCycleRow: 4,
    overwriteCheckRanges: ["C2"],
    playerInitialColumns: ["C", "M"],
    playerPerTeamLimit: 6,
    playerRow,
    rostersRange: "INSTRUCTIONS!A34:CV40",

    getClearRanges: (sheetName: string): string[] => {
        return [
            // Clear team names, then player names + buzzes, and then bonuses
            `'${sheetName}'!C2:K2`,
            `'${sheetName}'!M2:U2`,

            // Clear player names, buzzes, and subs
            `'${sheetName}'!C3:H29`,
            `'${sheetName}'!M3:R29`,

            // Clear bonuses
            `'${sheetName}'!I4:I27`,
            `'${sheetName}'!S4:S27`,
        ];
    },
    getRosters: (values: gapi.client.sheets.ValueRange): IRoster | undefined => {
        if (values.values == undefined) {
            return undefined;
        }

        // Format: array of teams, first element is the team name, other elements are the players
        const teamNames: string[] = values.values[0] ?? [];
        const players: Player[] = [];
        for (let i = 1; i < values.values.length; i++) {
            // Go through each row.
            const playersInRow: string[] = values.values[i];

            for (let j = 0; j < teamNames.length && j < playersInRow.length; j++) {
                const playerName: string = playersInRow[j];
                if (playerName != undefined && playerName !== "" && playerName !== "#REF!") {
                    // Add this player; their team name is i
                    players.push(new Player(playerName, teamNames[j], i < 5));
                }
            }
        }

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
        row: number,
        bonusesBounceBack: boolean
    ): gapi.client.sheets.ValueRange[] => {
        const isFirstTeamBonus = bonusAnswer.receivingTeamName === teamNames[0];
        const bonusColumn: string = isFirstTeamBonus ? "I" : "S";
        const bouncebackColumn: string = isFirstTeamBonus ? "T" : "J";

        let bonusScore = 0;
        let bouncebackScore = 0;
        for (const part of bonusAnswer.parts) {
            if (part.teamName === bonusAnswer.receivingTeamName) {
                bonusScore += part.points;
            } else if (bonusesBounceBack) {
                bouncebackScore += part.points;
            }
        }

        const ranges: gapi.client.sheets.ValueRange[] = [
            {
                range: `'${sheetName}'!${bonusColumn}${row}`,
                values: [[bonusScore]],
            },
        ];

        if (bonusesBounceBack) {
            ranges.push({
                range: `'${sheetName}'!${bouncebackColumn}${row}`,
                values: [[bouncebackScore]],
            });
        }

        return ranges;
    },
    getValuesForBonusClear: (): gapi.client.sheets.ValueRange[] => {
        // TJ Sheets can clear the bonus column with no loss of formatting, so use that instead
        return [];
    },
    getValuesForBonusProtests: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForBuzzPoints: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForDeadQuestion: (sheetName: string, row: number): gapi.client.sheets.ValueRange[] => {
        // We need to put DT for a dead tossup. Default to the first team.
        return [
            {
                range: `'${sheetName}'!I${row}`,
                values: [["DT"]],
            },
        ];
    },
    getValuesForPlayerJoins: (
        join: IPlayerJoinsEvent,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[] => {
        const inPlayerColumn: string | undefined = playerToColumnMapping.get(join.inPlayer);
        if (inPlayerColumn == undefined) {
            return [];
        }

        // 28 = In, 29 = Out
        // should be for round before (row - firstCycleRow + 1)
        const subRound: number = row - firstCycleRow + 1;
        return [
            // We need to include the player in the player list now, since TJSheets errors out if there's a
            // non-starter who never plays
            {
                range: `'${sheetName}'!${inPlayerColumn}${playerRow}`,
                values: [[join.inPlayer.name]],
            },
            {
                range: `'${sheetName}'!${inPlayerColumn}${subInRow}`,
                values: [[subRound]],
            },
        ];
    },
    getValuesForPlayerLeaves: (
        leave: IPlayerLeavesEvent,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[] => {
        const outPlayerColumn: string | undefined = playerToColumnMapping.get(leave.outPlayer);
        if (outPlayerColumn == undefined) {
            return [];
        }

        // should be for round before (row - firstCycleRow + 1)
        const subRound: number = row - firstCycleRow + 1;
        return [
            {
                range: `'${sheetName}'!${outPlayerColumn}${subOutRow}`,
                values: [[subRound]],
            },
        ];
    },
    getValuesForSubs: (
        sub: ISubstitutionEvent,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[] => {
        const inPlayerColumn: string | undefined = playerToColumnMapping.get(sub.inPlayer);
        if (inPlayerColumn == undefined) {
            return [];
        }

        const outPlayerColumn: string | undefined = playerToColumnMapping.get(sub.outPlayer);
        if (outPlayerColumn == undefined) {
            return [];
        }

        // should be for round before (row - firstCycleRow + 1)
        const subRound: number = row - firstCycleRow + 1;
        return [
            // We need to include the inPlayer in the player list now, since TJSheets errors out if there's a
            // substitute who never plays
            {
                range: `'${sheetName}'!${inPlayerColumn}${playerRow}`,
                values: [[sub.inPlayer.name]],
            },
            {
                range: `'${sheetName}'!${inPlayerColumn}${subInRow}`,
                values: [[subRound]],
            },
            {
                range: `'${sheetName}'!${outPlayerColumn}${subOutRow}`,
                values: [[subRound]],
            },
        ];
    },
    getValuesForTeams: (teamNames: string[], sheetName: string): gapi.client.sheets.ValueRange[] => {
        if (teamNames.length !== 2) {
            return [];
        }

        return [
            {
                range: `'${sheetName}'!C2:K2`,
                values: [[teamNames[0]]],
            },
            {
                range: `'${sheetName}'!M2:U2`,
                values: [[teamNames[1]]],
            },
        ];
    },
    getValuesForCorrectBuzz: (
        buzz: ITossupAnswerEvent,
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
                values: [[buzz.marker.points ?? 10]],
            },
        ];
    },
    getValuesForNeg: (
        buzz: ITossupAnswerEvent,
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
                // TODO: When formats are supported, figure out what value goes here (and return nothing if it's 0)
                values: [[-5]],
            },
        ];
    },
    getValuesForTossupProtests: (): gapi.client.sheets.ValueRange[] => [],
    getValuesForStartingLineups: (
        players: Player[],
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string
    ): gapi.client.sheets.ValueRange[] => {
        // TJ Sheets is very strict with validation, so if you have substitute players that are never subbed in, the
        // sheet will have errors. Therefore, we remove the values for non-starters, and add them back when they
        // are subbed in
        const ranges: gapi.client.sheets.ValueRange[] = [];
        for (const player of players) {
            if (!player.isStarter) {
                const column: string | undefined = playerToColumnMapping.get(player);
                if (column != undefined) {
                    ranges.push({
                        range: `'${sheetName}'!${column}${playerRow}`,
                        values: [[""]],
                    });
                }
            }
        }

        return ranges;
    },
    getValuesForTossupsHeard: (): gapi.client.sheets.ValueRange[] => [],
    isControlSheet: (): boolean => {
        // If the user gives us the control sheet, the GET call to get these values will fail we would do this check, so
        // ignore this check
        return false;
    },
};

function getSheetName(roundNumber: number): string {
    return `Round ${roundNumber ?? 1}`;
}
