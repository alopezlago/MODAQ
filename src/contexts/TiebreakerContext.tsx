import React from "react";

// A tiebreaker question the host (Klaxon) has made available. Identified by its
// source round + number so usage can be tracked.
export interface ITiebreakerItem {
    round: string;
    questionNumber: number;
    question: string;
    answer: string;
}

export interface ITiebreakerContextValue {
    tiebreakers: ITiebreakerItem[];

    /**
     * Append the tiebreaker at `index` to the current game (so a thrown-out or
     * next tossup reads it) and report that the current teams heard it.
     */
    addTiebreaker: (index: number) => void;

    /**
     * If the game no longer has enough tossups to finish (e.g. one was thrown
     * out at the end of the packet), append the next unused tiebreaker
     * automatically. Returns true if a question was added.
     */
    subInIfNeeded: () => boolean;
}

export const TiebreakerContext = React.createContext<ITiebreakerContextValue | undefined>(undefined);

export function useTiebreakers(): ITiebreakerContextValue | undefined {
    return React.useContext(TiebreakerContext);
}
