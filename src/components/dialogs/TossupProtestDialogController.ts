import { AppState } from "../../state/AppState";
import { Cycle } from "../../state/Cycle";
import { ITossupProtestEvent } from "../../state/Events";

export function commit(cycle: Cycle): void {
    const appState: AppState = AppState.instance;
    const pendingProtestEvent: ITossupProtestEvent | undefined = appState.uiState.pendingTossupProtestEvent;
    if (pendingProtestEvent) {
        cycle.addTossupProtest(
            pendingProtestEvent.teamName,
            pendingProtestEvent.questionIndex,
            pendingProtestEvent.position,
            pendingProtestEvent.givenAnswer,
            pendingProtestEvent.reason
        );
        appState.uiState.resetPendingTossupProtest();
    }
}

export function cancel(): void {
    AppState.instance.uiState.resetPendingTossupProtest();
}
