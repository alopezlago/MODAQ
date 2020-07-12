import { PacketState } from "./PacketState";
import { Player } from "./TeamState";

export interface IPendingNewGame {
    packet: PacketState;
    firstTeamPlayers: Player[];
    secondTeamPlayers: Player[];
}
