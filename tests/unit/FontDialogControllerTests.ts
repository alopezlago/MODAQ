import { expect } from "chai";

import * as FontDialogController from "src/components/dialogs/FontDialogController";
import { AppState } from "src/state/AppState";
import { DefaultFontFamily, FontDialogState } from "src/state/FontDialogState";

function initializeApp(): { appState: AppState; dialogState: FontDialogState } {
    const appState: AppState = new AppState();
    appState.uiState.setQuestionFontSize(16);
    showFontDialog(appState);

    const dialogState: FontDialogState | undefined = appState.uiState.dialogState.fontDialog;
    if (dialogState == undefined) {
        throw "Dialog state should be defined";
    }

    return { appState, dialogState };
}

function showFontDialog(appState: AppState): void {
    appState.uiState.dialogState.showFontDialog(
        appState.uiState.fontFamily,
        appState.uiState.questionFontSize,
        appState.uiState.questionFontColor,
        appState.uiState.pronunciationGuideColor
    );
}

describe("FontDialogControllerTests", () => {
    it("changeFontFamily specific font", () => {
        const { appState, dialogState } = initializeApp();

        const newFontFamily = "Comic Sans MS";
        FontDialogController.changeFontFamily(appState, newFontFamily);

        expect(dialogState.fontFamily).to.equal(newFontFamily + ", " + DefaultFontFamily);
    });

    it("changeFontFamily default font", () => {
        const { appState, dialogState } = initializeApp();

        FontDialogController.changeFontFamily(appState, undefined);

        expect(dialogState.fontFamily).to.equal(FontDialogController.defaultFont + ", " + DefaultFontFamily);
    });

    it("changeFontSize", () => {
        const { appState, dialogState } = initializeApp();

        const oldFontSize = dialogState.fontSize;
        const newFontSize = (oldFontSize ?? 16) + 8;
        FontDialogController.changePendingSize(appState, newFontSize.toString());

        expect(dialogState.fontSize).to.equal(newFontSize);
    });

    it("changeFontSize for invalid value", () => {
        const { appState, dialogState } = initializeApp();

        const oldFontSize = dialogState.fontSize;
        FontDialogController.changePendingSize(appState, "xyz");

        expect(dialogState.fontSize).to.equal(oldFontSize);
    });

    it("changeTextColor", () => {
        const { appState, dialogState } = initializeApp();

        const textColor = "black";
        FontDialogController.changeTextColor(appState, textColor);

        expect(dialogState.textColor).to.equal(textColor);
    });

    it("changePronunciationGuideColor", () => {
        const { appState, dialogState } = initializeApp();

        const pronunciationGuideColor = "purple";
        FontDialogController.changePronunciationGuideColor(appState, pronunciationGuideColor);

        expect(dialogState.pronunciationGuideColor).to.equal(pronunciationGuideColor);
    });

    it("update only font size", () => {
        const appState: AppState = new AppState();
        appState.uiState.setFontFamily("Comic Sans MS");
        appState.uiState.setQuestionFontSize(16);
        showFontDialog(appState);

        FontDialogController.changePendingSize(appState, "40");
        FontDialogController.update(appState);

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.questionFontSize).to.equal(40);
        expect(appState.uiState.fontFamily.startsWith("Comic Sans MS")).to.be.true;
    });

    it("update only font family", () => {
        const appState: AppState = new AppState();
        appState.uiState.setFontFamily("Comic Sans MS");
        appState.uiState.setQuestionFontSize(40);
        showFontDialog(appState);

        FontDialogController.changeFontFamily(appState, "Arial");
        FontDialogController.update(appState);

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.questionFontSize).to.equal(40);
        expect(appState.uiState.fontFamily.startsWith("Arial")).to.be.true;
    });

    it("update all", () => {
        const { appState } = initializeApp();

        FontDialogController.changePendingSize(appState, "40");
        FontDialogController.changeFontFamily(appState, "Comic Sans MS");
        FontDialogController.changeTextColor(appState, "black");
        FontDialogController.changePronunciationGuideColor(appState, "blue");
        FontDialogController.update(appState);

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontSize).to.be.undefined;
        expect(appState.uiState.questionFontSize).to.equal(40);
        expect(appState.uiState.fontFamily.startsWith("Comic Sans MS")).to.be.true;
        expect(appState.uiState.questionFontColor).to.equal("black");
        expect(appState.uiState.pronunciationGuideColor).to.equal("blue");
    });

    it("resest question text color", () => {
        const appState: AppState = new AppState();
        appState.uiState.setQuestionFontColor("black");
        showFontDialog(appState);

        FontDialogController.changeTextColor(appState, undefined);
        FontDialogController.update(appState);

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.questionFontColor).to.be.undefined;
    });

    it("resest pronunciation guide color", () => {
        const appState: AppState = new AppState();
        appState.uiState.setPronunciationGuideColor("purple");
        showFontDialog(appState);

        FontDialogController.changePronunciationGuideColor(appState, undefined);
        FontDialogController.update(appState);

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.pronunciationGuideColor).to.be.undefined;
    });

    it("hideDialog", () => {
        const { appState, dialogState } = initializeApp();
        expect(dialogState.fontSize).to.not.be.undefined;

        FontDialogController.cancel(appState);

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontSize).to.be.undefined;
    });
});
