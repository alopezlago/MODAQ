import { Player } from "./TeamState";

export interface IBuzzMarker {
    position: number;
    correct: boolean;
    player: Player;
}
