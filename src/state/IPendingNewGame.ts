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
    firstTeamPlayers: Player[];
    secondTeamPlayers: Player[];

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
