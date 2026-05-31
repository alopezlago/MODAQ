import { AppState } from "../../state/AppState";
import { Cycle } from "../../state/Cycle";
import { ITossupProtestEvent } from "../../state/Events";

export function commit(appState: AppState, cycle: Cycle): void {
    const pendingProtestEvent: ITossupProtestEvent | undefined = appState.uiState.pendingTossupProtestEvent;
    if (pendingProtestEvent) {
        const existingProtest = cycle.tossupProtests?.find((protest) => {
            return (
                protest.teamName === pendingProtestEvent.teamName &&
                protest.questionIndex === pendingProtestEvent.questionIndex
            );
        });

        if (existingProtest) {
            existingProtest.givenAnswer = pendingProtestEvent.givenAnswer;
            existingProtest.reason = pendingProtestEvent.reason;
        } else {
            cycle.addTossupProtest(
                pendingProtestEvent.teamName,
                pendingProtestEvent.questionIndex,
                pendingProtestEvent.position,
                pendingProtestEvent.givenAnswer,
                pendingProtestEvent.reason
            );
        }

        appState.uiState.resetPendingTossupProtest();
    }
}

export function cancel(appState: AppState): void {
    appState.uiState.resetPendingTossupProtest();
}
