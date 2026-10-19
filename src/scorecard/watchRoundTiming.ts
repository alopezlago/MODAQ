// Experimental (moderator scorecard): feeds RoundTiming from the game as the moderator plays it -- the question on
// screen, rulings entered on it, bonus parts scored, and buzzes recognized by hand. Returns a disposer.

import { comparer, reaction } from "mobx";

import * as RoundTiming from "./RoundTiming";
import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";

export function watchRoundTiming(appState: AppState): () => void {
    // Reads the length first: MobX doesn't track an index past the end, so a watch started before the game's cycles
    // exist would otherwise never hear about them
    const currentCycle = (): Cycle | undefined => {
        const cycles: Cycle[] = appState.game.cycles;
        const cycleIndex: number = appState.uiState.cycleIndex;
        return cycleIndex < cycles.length ? cycles[cycleIndex] : undefined;
    };
    const disposers: (() => void)[] = [
        // The question on screen
        reaction(
            () => [appState.uiState.roundScorecard, appState.game.isLoaded, appState.uiState.cycleIndex] as const,
            ([on, isLoaded, cycleIndex]) => {
                if (on && isLoaded) {
                    RoundTiming.recordQuestionShown(cycleIndex, appState.game.getTossupIndex(cycleIndex) + 1);
                }
            },
            { fireImmediately: true }
        ),
        // Rulings entered on it. Compared by value: a co-reader's change rebuilds the cycle objects
        reaction(
            () => {
                const cycle: Cycle | undefined = currentCycle();
                return {
                    cycleIndex: appState.uiState.cycleIndex,
                    correct: cycle?.correctBuzz?.marker.position,
                    wrong: (cycle?.wrongBuzzes ?? []).map((buzz) => buzz.marker.position),
                    parts: (cycle?.bonusAnswer?.parts ?? []).map((part) => part.points),
                };
            },
            (next, previous) => {
                if (previous == undefined || next.cycleIndex !== previous.cycleIndex) {
                    return;
                }

                if (next.wrong.length > previous.wrong.length) {
                    RoundTiming.recordRuling(false, next.wrong[next.wrong.length - 1]);
                }
                if (next.correct != undefined && next.correct !== previous.correct) {
                    RoundTiming.recordRuling(true, next.correct);
                }
                next.parts.forEach((points, index) => {
                    if (previous.parts.length > 0 && points !== previous.parts[index]) {
                        RoundTiming.recordBonusPartScored(index);
                    }
                });
            },
            { equals: comparer.structural }
        ),
        // A buzz recognized by hand: Space, or the buzz menu opening
        reaction(
            () => appState.uiState.buzzPointPlacement != undefined || appState.uiState.buzzMenuState.visible,
            (recognizing) => {
                if (recognizing) {
                    RoundTiming.recordBuzzRecognized();
                }
            }
        ),
    ];
    return () => disposers.forEach((dispose) => dispose());
}
