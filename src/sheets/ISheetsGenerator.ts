import { Cycle } from "../state/Cycle";
import {
    IBonusAnswerEvent,
    IBonusProtestEvent,
    IPlayerJoinsEvent,
    IPlayerLeavesEvent,
    ISubstitutionEvent,
    ITossupAnswerEvent,
    ITossupProtestEvent,
} from "../state/Events";
import { Player } from "../state/TeamState";
import { IPlayerToColumnMap } from "./PlayerToColumnMap";
export interface ISheetsGenerator {
    // Ranges for teams and players in the rosters sheet
    readonly rostersRange: string;

    // The row for the first tossup/bonus cycle
    readonly firstCycleRow: number;

    // The row of the scoresheet where players are listed
    readonly playerRow: number;

    // The inital column for players on a given team. For example, if players on team 1 are in columns C-H and O-T, the
    // values would be [C, H]
    readonly playerInitialColumns: string[];

    // The range to check for values to see if this sheet has already been filled in
    readonly overwriteCheckRanges: string[];
    readonly playerPerTeamLimit: number;

    // Should be maximum number of cycles, inclusive, i.e. if the scoresheet only has 20 cells for scoring, then 20
    readonly cyclesLimit: number;

    // If the Sheet needs to record buzzes that have no penalty (0 points)
    readonly writeNoPenaltyBuzzes: boolean;

    // TODO: Method to generate player/column mapping... and maybe we pass that in? Could also just have starting
    // columns for each player
    // Means we can't support horizontal-based scoresheets
    // TODO: Get methods for ranges/values of different cycle events
    getRosters(values: gapi.client.sheets.ValueRange): IRoster | undefined;
    getSheetName(roundNumber: number): string;

    // All the ranges that could have values already filled in that we should clear
    getClearRanges(sheetName: string): string[];
    getValuesForSubs(
        sub: ISubstitutionEvent,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[];
    getValuesForPlayerJoins(
        join: IPlayerJoinsEvent,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[];
    getValuesForPlayerLeaves(
        leave: IPlayerLeavesEvent,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[];
    getValuesForTossupProtests(
        protests: ITossupProtestEvent[],
        teamNames: string[],
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[];
    getValuesForBonusProtests(
        protests: IBonusProtestEvent[],
        teamNames: string[],
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[];
    getValuesForCorrectBuzz(
        buzz: ITossupAnswerEvent,
        points: number,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[];
    getValuesForNeg(
        buzz: ITossupAnswerEvent,
        points: number,
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string,
        row: number
    ): gapi.client.sheets.ValueRange[];
    getValuesForBonusAnswer(
        bonusAnswer: IBonusAnswerEvent,
        teamNames: string[],
        sheetName: string,
        row: number,
        bouncesBounceBack: boolean
    ): gapi.client.sheets.ValueRange[];

    // Some sheets add formatting to the bonus cells, so we can't clear them. These get the values to "clear" the cell
    getValuesForBonusClear(sheetName: string): gapi.client.sheets.ValueRange[];
    getValuesForDeadQuestion(sheetName: string, row: number): gapi.client.sheets.ValueRange[];
    getValuesForBuzzPoints(buzzPoints: number[], sheetName: string, row: number): gapi.client.sheets.ValueRange[];
    getValuesForTeams(teamNames: string[], sheetName: string): gapi.client.sheets.ValueRange[];
    getValuesForStartingLineups(
        players: Player[],
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string
    ): gapi.client.sheets.ValueRange[];
    getValuesForTossupsHeard(
        cycles: Cycle[],
        players: Player[],
        playerToColumnMapping: IPlayerToColumnMap,
        sheetName: string
    ): gapi.client.sheets.ValueRange[];
    isControlSheet(values: gapi.client.sheets.ValueRange): boolean;
}

export interface IRoster {
    teamNames: string[];
    players: Player[];
}
