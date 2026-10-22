/**
 * The buzz point being placed with the keyboard (see UIState.buzzPointPlacement).
 */
export interface IBuzzPointPlacement {
    /** When placement started (ms) */
    startTime: number;

    /**
     * The reader's position when placement started, or -1 if unknown. Words recognized shortly afterward were
     * spoken before the buzz, so they still move the buzz point forward (see TossupQuestionController).
     */
    startLivePosition: number;

    /** The configured buzz point offset at the time, applied to late-recognized words too */
    wordOffset: number;

    /** Whether the moderator has moved the buzz point with the arrow keys; then late words don't move it */
    movedManually: boolean;

    /** The furthest reading position seen during placement (the start position, plus any late words) */
    latestLivePosition: number;

    /**
     * Whether a buzzer sound started this placement rather than Space. The moderator's Space right after the buzzer
     * then confirms it instead of opening the buzz menu.
     */
    startedByBuzzSound: boolean;
}
