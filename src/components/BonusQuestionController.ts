import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";

export function throwOutBonus(cycle: Cycle, bonusIndex: number): void {
    const appState: AppState = AppState.instance;

    appState.uiState.dialogState.showOKCancelMessageDialog(
        "Throw out Bonus",
        "Click OK to throw out the bonus. To undo this, click on the X next to its event in the Event Log.",
        () => onConfirmThrowOutBonus(cycle, bonusIndex)
    );
}

function onConfirmThrowOutBonus(cycle: Cycle, bonusIndex: number) {
    cycle.addThrownOutBonus(bonusIndex);
}
