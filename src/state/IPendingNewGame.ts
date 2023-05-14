import { Cycle } from "./Cycle";
import { IGameFormat } from "./IGameFormat";
import { PacketState } from "./PacketState";
import { Player } from "./TeamState";

export type IPendingNewGame = IPendingManualNewGame | IPendingFromSheetsNewGame | IPendingQBJRegistrationNewGame;

export interface IPendingManualNewGame extends IBasePendingNewGame {
    firstTeamPlayers: Player[];
    secondTeamPlayers: Player[];
    cycles?: Cycle[];
    type: PendingGameType.Manual;
}

export const enum PendingGameType {
    Manual,
    TJSheets,
    UCSDSheets,
    QBJRegistration,
}

export interface IPendingFromSheetsNewGame extends IBasePendingNewGame {
    rostersUrl: string | undefined;
    playersFromRosters: Player[] | undefined;
    firstTeamPlayersFromRosters: Player[] | undefined;
    secondTeamPlayersFromRosters: Player[] | undefined;
    type: PendingGameType.TJSheets | PendingGameType.UCSDSheets;
}

export interface IPendingQBJRegistrationNewGame extends IBasePendingNewGame {
    players: Player[];
    firstTeamPlayers: Player[] | undefined;
    secondTeamPlayers: Player[] | undefined;
    cycles?: Cycle[];
    type: PendingGameType.QBJRegistration;
}

interface IBasePendingNewGame {
    packet: PacketState;
    gameFormat: IGameFormat;
}
