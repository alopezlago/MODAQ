import { FontDialogState } from "../../state/FontDialogState";
import { AppState } from "../../state/AppState";

export const defaultFont = "Segoe UI";

const minimumFontSize = 12;

export function cancel(): void {
    hideDialog();
}

export function changePendingSize(newValue: string): void {
    const appState: AppState = AppState.instance;

    const size = Number.parseInt(newValue, 10);
    if (!isNaN(size)) {
        appState.uiState.dialogState.fontDialog?.setFontSize(size);
    }
}

export function changeFontFamily(newValue: string | undefined): void {
    AppState.instance.uiState.dialogState.fontDialog?.setFontFamily(newValue ?? defaultFont);
}

export function changePronunciationGuideColor(color: string | undefined): void {
    if (color == undefined) {
        AppState.instance.uiState.dialogState.fontDialog?.resetPronunciationGuideColor();
    } else {
        AppState.instance.uiState.dialogState.fontDialog?.setPronunciationGuideColor(color);
    }
}

export function changeTextColor(color: string | undefined): void {
    if (color == undefined) {
        AppState.instance.uiState.dialogState.fontDialog?.resetTextColor();
    } else {
        AppState.instance.uiState.dialogState.fontDialog?.setTextColor(color);
    }
}

export function update(): void {
    const appState: AppState = AppState.instance;
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

    hideDialog();
}

function hideDialog(): void {
    AppState.instance.uiState.dialogState.hideFontDialog();
}
