import { PacketState } from "./PacketState";
import { Player } from "./TeamState";

export type IPendingNewGame = IPendingManualNewGame | IPendingLifsheetsNewGame;

interface IPendingManualNewGame extends IBasePendingNewGame {
    firstTeamPlayers: Player[];
    secondTeamPlayers: Player[];
    type: PendingGameType.Manual;
}

export const enum PendingGameType {
    Manual,
    Lifsheets,
}

interface IPendingLifsheetsNewGame extends IBasePendingNewGame {
    rostersUrl: string | undefined;
    playersFromRosters: Player[] | undefined;
    firstTeamPlayersFromRosters: Player[] | undefined;
    secondTeamPlayersFromRosters: Player[] | undefined;
    type: PendingGameType.Lifsheets;
}

interface IBasePendingNewGame {
    packet: PacketState;
}
