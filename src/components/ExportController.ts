import { AppState } from "../state/AppState";
import { StatusDisplayType } from "../state/StatusDisplayType";

/**
 * The end of the round, i.e. "Export..." on the last question. If the moderator marked any errata, they review them
 * (and add details) first; otherwise this goes straight to the export.
 */
export function finishRound(appState: AppState): void {
    if (appState.errata.errata.length > 0) {
        appState.uiState.dialogState.showErrataDialog();
        return;
    }

    exportGame(appState);
}

/**
 * Opens whichever export the host is set up for.
 */
export function exportGame(appState: AppState): void {
    // If they use Sheets, show the Export Sheets dialog. Otherwise, show the Export JSON dialog
    if (appState.uiState.customExportOptions != undefined) {
        appState.handleCustomExport(StatusDisplayType.MessageDialog, "NextButton");
    } else if (appState.uiState.sheetsState.sheetId != undefined) {
        appState.uiState.createPendingSheet();
    } else {
        appState.uiState.dialogState.showExportToJsonDialog();
    }
}
