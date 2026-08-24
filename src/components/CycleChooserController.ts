import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";
import { UIState } from "../state/UIState";
import * as GameFormats from "../state/GameFormats";

// Previous/Next walk the reading order rather than the cycle list. Ordinarily a question is one step (the tossup
// and its bonus are on screen together), but in "one question at a time" mode a converted tossup adds a second
// step for its bonus -- so Next after a correct buzz reads the bonus, and Next after a dead tossup moves on.

/**
 * Whether the cycle's bonus is read at all: someone converted the tossup, and the format has bonuses at this
 * point in the game. A packet that has run out of bonuses still counts, so the reader sees that (and can score
 * the bonus elsewhere) instead of the bonus silently disappearing.
 */
export function hasBonusStep(appState: AppState, cycleIndex: number): boolean {
    const cycle: Cycle | undefined = appState.game.cycles[cycleIndex];
    if (cycle?.correctBuzz == undefined) {
        return false;
    }

    if (!GameFormats.hasBonuses(appState.game.gameFormat)) {
        // Tossup-only formats like IPNCT never have a bonus step
        return false;
    }

    return (
        appState.game.gameFormat.overtimeIncludesBonuses || cycleIndex < appState.game.gameFormat.regulationTossupCount
    );
}

/**
 * Whether the reader is on the bonus half of the current question. Always false outside the mode, and false when
 * the cycle lost its correct buzz while the bonus was up (e.g. the reader undid it), so the view falls back to
 * the tossup instead of showing a bonus that is no longer in play.
 */
export function isOnBonus(appState: AppState): boolean {
    const uiState: UIState = appState.uiState;
    return uiState.oneQuestionAtATime && uiState.showingBonus && hasBonusStep(appState, uiState.cycleIndex);
}

/**
 * Whether Next moves to this cycle's bonus instead of the next question.
 */
export function nextStepIsBonus(appState: AppState): boolean {
    return (
        appState.uiState.oneQuestionAtATime &&
        !isOnBonus(appState) &&
        hasBonusStep(appState, appState.uiState.cycleIndex)
    );
}

/**
 * Whether the reader is at the end of the game, which is where Next turns into Export. The last tossup's bonus
 * still has to be read, so a pending bonus step keeps Next as Next.
 */
export function isOnLastStep(appState: AppState): boolean {
    if (nextStepIsBonus(appState)) {
        return false;
    }

    return appState.uiState.cycleIndex + 1 >= appState.game.playableCycles.length;
}

export function canGoPrevious(appState: AppState): boolean {
    return isOnBonus(appState) || appState.uiState.cycleIndex > 0;
}

export function next(appState: AppState): void {
    if (nextStepIsBonus(appState)) {
        appState.uiState.setShowingBonus(true);
        return;
    }

    // setCycleIndex lands on the tossup, which is where the next question starts
    appState.uiState.nextCycle();
}

export function previous(appState: AppState): void {
    if (isOnBonus(appState)) {
        appState.uiState.setShowingBonus(false);
        return;
    }

    const previousCycleIndex: number = appState.uiState.cycleIndex - 1;
    if (previousCycleIndex < 0) {
        return;
    }

    appState.uiState.previousCycle();

    // Going back into a question that was converted lands on its bonus, since that's the last thing that was read
    if (appState.uiState.oneQuestionAtATime && hasBonusStep(appState, previousCycleIndex)) {
        appState.uiState.setShowingBonus(true);
    }
}
