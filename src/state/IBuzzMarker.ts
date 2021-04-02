import { IPlayer } from "./TeamState";

export interface IBuzzMarker {
    isLastWord?: boolean;
    position: number;
    player: IPlayer;
    points: number;
}
