import { IPlayer } from "./TeamState";

export interface IBuzzMarker {
    isLastWord?: boolean;
    position: number;
    player: IPlayer;

    // This is just a snapshot of how much the question was worth when it was scored. For the true point value, we
    // should rely on Tossup.getPointsAtPosition with the position field passed in.
    // TODO: We may want to change this to "isCorrect" to simplify the logic in some places
    points: number;
}
