/**
 * A buzz just recorded (or removed) from the player pad, shown briefly (see UIState.buzzFeedback).
 */
export interface IBuzzFeedback {
    /** Changes with every buzz, so the animation restarts even for the same player */
    id: number;

    kind: "correct" | "wrong" | "removed";

    playerName: string;

    teamName: string;

    /** Points the buzz scored (negative for a neg); 0 for a removal or a wrong buzz without a penalty */
    points: number;

    /** The word the buzz is on */
    position: number;
}
