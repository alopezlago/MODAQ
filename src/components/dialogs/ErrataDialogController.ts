import { AppState } from "../../state/AppState";
import { ErrataDialogState } from "../../state/ErrataDialogState";
import { QuestionType } from "../../state/IErratum";

export function showDialog(appState: AppState, questionNumber: number, questionType: QuestionType): void {
    // Editing an existing erratum starts from what's already there
    const text: string = appState.errata.getErratum(questionNumber, questionType)?.text ?? "";
    appState.uiState.dialogState.showErrataDialog(questionNumber, questionType, text);
}

export function changeText(appState: AppState, text: string): void {
    appState.uiState.dialogState.errataDialog?.setText(text);
}

export function submit(appState: AppState): void {
    const errataDialog: ErrataDialogState | undefined = appState.uiState.dialogState.errataDialog;
    if (errataDialog == undefined) {
        return;
    }

    // Blank text removes the erratum, so clearing the field is the same as deleting it
    appState.errata.setErratum({
        questionNumber: errataDialog.questionNumber,
        questionType: errataDialog.questionType,
        thrownOut: false,
        text: errataDialog.text,
    });

    hideDialog(appState);
}

export function removeErratum(appState: AppState): void {
    const errataDialog: ErrataDialogState | undefined = appState.uiState.dialogState.errataDialog;
    if (errataDialog == undefined) {
        return;
    }

    appState.errata.removeErratum(errataDialog.questionNumber, errataDialog.questionType);
    hideDialog(appState);
}

export function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideErrataDialog();
}
