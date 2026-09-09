import { Cycle } from "./Cycle";
import { IGameFormat } from "./IGameFormat";
import { PacketState } from "./PacketState";
import { Player } from "./TeamState";

export type IPendingNewGame =
    | IPendingManualNewGame
    | IPendingFromTJSheetsNewGame
    | IPendingFromUCSDSheetsNewGame
    | IPendingQBJRegistrationNewGame;

export interface IPendingManualNewGame extends IBasePendingNewGame {
    manual: IPendingManualNewGameState;
    type: PendingGameType.Manual;
}

export interface IPendingFromTJSheetsNewGame extends IBasePendingNewGame {
    tjSheets: IPendingFromSheetsNewGameState;
    type: PendingGameType.TJSheets;
}

export interface IPendingFromUCSDSheetsNewGame extends IBasePendingNewGame {
    ucsdSheets: IPendingFromSheetsNewGameState;
    type: PendingGameType.UCSDSheets;
}

export interface IPendingQBJRegistrationNewGame extends IBasePendingNewGame {
    registration: IPendingQBJRegistrationNewGameState;
    type: PendingGameType.QBJRegistration;
}

export interface IPendingManualNewGameState {
    /**
     * The teams being entered, one roster each.
     *
     * A game is no longer limited to two: `GameFormats.getMaximumTeamCount`
     * says how many the format allows, and the New Game dialog adds and
     * removes them. The scoring engine and the QBJ export were already written
     * against an arbitrary number of teams -- every score is an array indexed
     * by `teamNames` -- so this was what actually held a three-team game back.
     *
     * Two is still the overwhelmingly common case, and some things only mean
     * anything with exactly two sides: a Sheets scoresheet, the QBJ's bonus
     * bounceback, the protest swing maths. Those read entries 0 and 1 and are
     * guarded by a team count where they are used.
     */
    teamPlayers: Player[][];

    // Competitors in an individual format (e.g. IPNCT), where each player is their own one-player team. Kept
    // separate from the team rosters so switching formats back and forth doesn't lose what was typed.
    individualPlayers: Player[];

    cycles?: Cycle[];
}

export const enum PendingGameType {
    Manual,
    TJSheets,
    UCSDSheets,
    QBJRegistration,
}

export interface IPendingFromSheetsNewGameState {
    rostersUrl: string | undefined;
    playersFromRosters: Player[] | undefined;
    firstTeamPlayersFromRosters: Player[] | undefined;
    secondTeamPlayersFromRosters: Player[] | undefined;
}

export interface IPendingQBJRegistrationNewGameState {
    players: Player[];
    firstTeamPlayers: Player[] | undefined;
    secondTeamPlayers: Player[] | undefined;

    // Competitors picked out of the roster for an individual format, where each one is their own team
    individualPlayers?: Player[];

    cycles?: Cycle[];
    errorMessage?: string;
}

interface IBasePendingNewGame {
    packet: PacketState;
    gameFormat: IGameFormat;
    type: PendingGameType;
}
