import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";
import { getThrowOutQuestionPrompt } from "./ThrowOutQuestionMessage";

export function throwOutBonus(appState: AppState, cycle: Cycle, bonusIndex: number): void {
    const cycleIndex: number = appState.activeGame.cycles.indexOf(cycle);
    const currentBonusNumber: number = bonusIndex + 1;
    const { message, replacementIndex, defaultReplacementIsExplicit } = getThrowOutQuestionPrompt(
        appState,
        cycleIndex,
        "bonus",
        currentBonusNumber
    );
    const totalBonuses: number = appState.activeGame.packet.bonuses.length;
    appState.uiState.dialogState.showThrowOutQuestionDialog({
        title: "Throw Out Bonus",
        message: `${message} To undo this, click on the X next to its event in the Event Log.`,
        minQuestionNumber: currentBonusNumber + 1,
        defaultReplacementIsExplicit,
        defaultReplacementNumber: replacementIndex != undefined ? replacementIndex + 1 : undefined,
        maxQuestionNumber: totalBonuses,
        onConfirm: (userReplacementIndex) => onConfirmThrowOutBonus(cycle, bonusIndex, userReplacementIndex),
    });
}

function onConfirmThrowOutBonus(cycle: Cycle, bonusIndex: number, replacementIndex: number | undefined) {
    cycle.addThrownOutBonus(bonusIndex, replacementIndex);
}
