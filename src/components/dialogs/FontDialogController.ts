import { FontDialogState } from "../../state/FontDialogState";
import { AppState } from "../../state/AppState";

export const defaultFont = "Segoe UI";

const minimumFontSize = 12;

export function cancel(appState: AppState): void {
    hideDialog(appState);
}

export function changePendingSize(appState: AppState, newValue: string): void {
    const size = Number.parseInt(newValue, 10);
    if (!isNaN(size)) {
        appState.uiState.dialogState.fontDialog?.setFontSize(size);
    }
}

export function changeFontFamily(appState: AppState, newValue: string | undefined): void {
    appState.uiState.dialogState.fontDialog?.setFontFamily(newValue ?? defaultFont);
}

export function changePronunciationGuideColor(appState: AppState, color: string | undefined): void {
    if (color == undefined) {
        appState.uiState.dialogState.fontDialog?.resetPronunciationGuideColor();
    } else {
        appState.uiState.dialogState.fontDialog?.setPronunciationGuideColor(color);
    }
}

export function changeTextColor(appState: AppState, color: string | undefined): void {
    if (color == undefined) {
        appState.uiState.dialogState.fontDialog?.resetTextColor();
    } else {
        appState.uiState.dialogState.fontDialog?.setTextColor(color);
    }
}

export function update(appState: AppState): void {
    const dialogState: FontDialogState | undefined = appState.uiState.dialogState.fontDialog;
    if (dialogState == undefined) {
        return;
    }

    if (dialogState.fontFamily != undefined) {
        appState.uiState.setFontFamily(appState.uiState.dialogState.fontDialog?.fontFamily ?? defaultFont);
    }

    if (dialogState.fontSize != undefined) {
        appState.uiState.setQuestionFontSize(appState.uiState.dialogState.fontDialog?.fontSize ?? minimumFontSize);
    }

    // undefined is the default color for text/pronunciation guide color, so always set it to what the dialog had
    appState.uiState.setPronunciationGuideColor(dialogState.pronunciationGuideColor);
    appState.uiState.setQuestionFontColor(dialogState.textColor);

    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideFontDialog();
}
