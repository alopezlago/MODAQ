import {
    IBonusAnswerEvent,
    IBonusProtestEvent,
    IPlayerJoinsEvent,
    IPlayerLeavesEvent,
    ISubstitutionEvent,
    ITossupAnswerEvent,
    ITossupProtestEvent,
} from "src/state/Events";
import { Player } from "src/state/TeamState";
import { IRoster, ISheetsGenerator } from "./ISheetsGenerator";
import { IPlayerToColumnMap } from "./PlayerToColumnMap";

const firstCycleRow = 8;

export const LifsheetsGenerator: ISheetsGenerator = {
    cyclesLimit: 21,
    firstCycleRow: 8,
    overwriteCheckRanges: ["C5"],
    playerInitialColumns: ["B", "R"],
    playerPerTeamLimit: 6,
    playerRow: 7,
    rostersRange: "Rosters!A2:L",
    writeNoPenaltyBuzzes: false,

    getClearRanges: (sheetName: string): string[] => {
        return [
            // Clear team names, then player names + buzzes, and then bonuses
            `'${sheetName}'!C5:C5`,
            `'${sheetName}'!S5:S5`,

            // Clear player names and buzzes plus bonuses
            `'${sheetName}'!B7:G28`,
            `'${sheetName}'!H8:H27`,

            // Clear bonuses
            `'${sheetName}'!R7:W28`,
            `'${sheetName}'!X8:X27`,

            // Clear protests
            `'${sheetName}'!AF8:AH28`,

            // Clear buzz points
            `'${sheetName}'!AJ8:AK28`,
        ];
    },
    getRosters: (values: gapi.client.sheets.ValueRange): IRoster | undefined => {
        if (values.values == undefined) {
            return undefined;
        }

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
        const bonusColumn: string = bonusAnswer.receivingTeamName === teamNames[0] ? "H" : "X";

        let bonusScore = "";
        for (let i = 0; i < 3; i++) {
            bonusScore += bonusAnswer.parts[i].points > 0 ? "1" : "0";
        }

        return [
            {
                range: `'${sheetName}'!${bonusColumn}${row}`,
                values: [[bonusScore]],
            },
        ];
    },
    getValuesForBonusClear: (): gapi.client.sheets.ValueRange[] => {
        // Lifsheets can clear the bonus column with no loss of formatting, so use that instead
        return [];
    },
    getValuesForBonusProtests: (
        protests: IBonusProtestEvent[],
        teamNames: string[],
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[] => {
        const protestReasons: string = protests.reduce((state: string, current: IBonusProtestEvent) => {
            return `${state}\n${current.reason}`;
        }, "");

        return [
            {
                range: `'${sheetName}'!AH${row}`,
                values: [[protestReasons.trim()]],
            },
        ];
    },
    getValuesForBuzzPoints: (buzzPoints: number[], sheetName: string, row: number): gapi.client.sheets.ValueRange[] => {
        const sortedBuzzPoints: number[] = [...buzzPoints].sort(compareNumbers);
        const valueRanges: gapi.client.sheets.ValueRange[] = [];

        for (let i = 0; i < 2 && i < sortedBuzzPoints.length; i++) {
            const column: string = i === 0 ? "AJ" : "AK";

            valueRanges.push({
                range: `'${sheetName}'!${column}${row}`,
                values: [[buzzPoints[i]]],
            });
        }

        return valueRanges;
    },
    getValuesForDeadQuestion: (sheetName: string, row: number): gapi.client.sheets.ValueRange[] => {
        return [
            {
                range: `'${sheetName}'!Q${row}`,
                values: [[1]],
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

        // In goes in the previous row, unless they were subbed in on the first tossup, in which case replace Out
        // with blank
        // See https://minkowski.space/quizbowl/manuals/scorekeeping/moderator.html#substitutions
        const inRow: number = row === firstCycleRow ? row : row - 1;
        return [
            {
                range: `'${sheetName}'!${inPlayerColumn}${inRow}`,
                values: [[inRow === firstCycleRow ? "" : "In"]],
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

        return [
            {
                range: `'${sheetName}'!${outPlayerColumn}${row}`,
                values: [["Out"]],
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

        // In goes in the previous row, unless they were subbed in on the first tossup, in which case replace Out
        // with blank
        // See https://minkowski.space/quizbowl/manuals/scorekeeping/moderator.html#substitutions
        const inRow: number = row === firstCycleRow ? row : row - 1;
        return [
            {
                range: `'${sheetName}'!${inPlayerColumn}${inRow}`,
                values: [[inRow === firstCycleRow ? "" : "In"]],
            },
            {
                range: `'${sheetName}'!${outPlayerColumn}${row}`,
                values: [["Out"]],
            },
        ];
    },
    getValuesForTeams: (teamNames: string[], sheetName: string): gapi.client.sheets.ValueRange[] => {
        if (teamNames.length !== 2) {
            return [];
        }

        const firstTeamName: string = teamNames[0];
        return [
            {
                range: `'${sheetName}'!C5`,
                values: [[firstTeamName]],
            },
            {
                range: `'${sheetName}'!S5`,
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
    getValuesForTossupProtests: (
        protests: ITossupProtestEvent[],
        teamNames: string[],
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[] => {
        const valueRanges: gapi.client.sheets.ValueRange[] = [];

        for (const protest of protests) {
            const protestColumn: string = protest.teamName === teamNames[0] ? "AF" : "AG";
            valueRanges.push({
                range: `'${sheetName}'!${protestColumn}${row}`,
                values: [[protest.reason]],
            });
        }

        return valueRanges;
    },
    getValuesForStartingLineups: (
        players: Player[],
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string
    ): gapi.client.sheets.ValueRange[] => {
        const valueRanges: gapi.client.sheets.ValueRange[] = [];

        for (const player of players.filter((p) => !p.isStarter)) {
            const playerColumn: string | undefined = playerToColumnMapping.get(player);
            if (playerColumn != undefined) {
                valueRanges.push({
                    range: `'${sheetName}'!${playerColumn}${firstCycleRow}`,
                    values: [["Out"]],
                });
            }
        }

        return valueRanges;
    },
    getValuesForTossupsHeard: (): gapi.client.sheets.ValueRange[] => [],
    isControlSheet: (values: gapi.client.sheets.ValueRange): boolean => {
        if (values.values == undefined || values.values[0] == undefined) {
            // The control sheet should have values where we checked
            return false;
        }

        return values.values[0].length > 2 && values.values[0][0] === "1" && values.values[0][1] === "";
    },
};

function getSheetName(roundNumber: number): string {
    return `Round ${roundNumber ?? 1}`;
}

function compareNumbers(left: number, right: number): number {
    return left - right;
}
