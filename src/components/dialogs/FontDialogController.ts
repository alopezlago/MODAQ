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
        appState.uiState.setPendingFontSize(size);
    }
}

export function changeFontFamily(newValue: string | undefined): void {
    AppState.instance.uiState.setPendingFontFamily(newValue ?? defaultFont);
}

export function update(): void {
    const appState: AppState = AppState.instance;
    if (appState.uiState.pendingFontSize != undefined) {
        appState.uiState.setFontFamily(appState.uiState.pendingFontFamily ?? defaultFont);
        appState.uiState.setQuestionFontSize(appState.uiState.pendingFontSize ?? minimumFontSize);
        hideDialog();
    }
}

function hideDialog(): void {
    AppState.instance.uiState.resetPendingFonts();
}
