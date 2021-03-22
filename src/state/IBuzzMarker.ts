import { IPlayer } from "./TeamState";

export interface IBuzzMarker {
    position: number;
    player: IPlayer;
    points: number;
}
