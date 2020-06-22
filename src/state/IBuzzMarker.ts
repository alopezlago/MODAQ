import { IPlayer } from "./TeamState";

export interface IBuzzMarker {
    position: number;
    correct: boolean;
    player: IPlayer;
}
