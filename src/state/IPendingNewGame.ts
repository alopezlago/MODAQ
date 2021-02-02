import { PacketState } from "./PacketState";
import { Player } from "./TeamState";

export type IPendingNewGame = IPendingManualNewGame | IPendingLifSheetsNewGame;

interface IPendingManualNewGame extends IBasePendingNewGame {
    firstTeamPlayers: Player[];
    secondTeamPlayers: Player[];
    type: PendingGameType.Manual;
}

export const enum PendingGameType {
    Manual,
    LifSheets,
}

interface IPendingLifSheetsNewGame extends IBasePendingNewGame {
    rostersUrl: string | undefined;
    playersFromRosters: Player[] | undefined;
    firstTeamPlayersFromRosters: Player[] | undefined;
    secondTeamPlayersFromRosters: Player[] | undefined;
    type: PendingGameType.LifSheets;
}

interface IBasePendingNewGame {
    packet: PacketState;
}
