import { expect } from "chai";

import * as FontDialogController from "src/components/dialogs/FontDialogController";
import { AppState } from "src/state/AppState";
import { DefaultFontFamily, FontDialogState } from "src/state/FontDialogState";

function initializeApp(): { appState: AppState; dialogState: FontDialogState } {
    AppState.resetInstance();
    const appState: AppState = AppState.instance;
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
        const { dialogState } = initializeApp();

        const newFontFamily = "Comic Sans MS";
        FontDialogController.changeFontFamily(newFontFamily);

        expect(dialogState.fontFamily).to.equal(newFontFamily + ", " + DefaultFontFamily);
    });

    it("changeFontFamily default font", () => {
        const { dialogState } = initializeApp();

        FontDialogController.changeFontFamily(undefined);

        expect(dialogState.fontFamily).to.equal(FontDialogController.defaultFont + ", " + DefaultFontFamily);
    });

    it("changeFontSize", () => {
        const { dialogState } = initializeApp();

        const oldFontSize = dialogState.fontSize;
        const newFontSize = (oldFontSize ?? 16) + 8;
        FontDialogController.changePendingSize(newFontSize.toString());

        expect(dialogState.fontSize).to.equal(newFontSize);
    });

    it("changeFontSize for invalid value", () => {
        const { dialogState } = initializeApp();

        const oldFontSize = dialogState.fontSize;
        FontDialogController.changePendingSize("xyz");

        expect(dialogState.fontSize).to.equal(oldFontSize);
    });

    it("changeTextColor", () => {
        const { dialogState } = initializeApp();

        const textColor = "black";
        FontDialogController.changeTextColor(textColor);

        expect(dialogState.textColor).to.equal(textColor);
    });

    it("changePronunciationGuideColor", () => {
        const { dialogState } = initializeApp();

        const pronunciationGuideColor = "purple";
        FontDialogController.changePronunciationGuideColor(pronunciationGuideColor);

        expect(dialogState.pronunciationGuideColor).to.equal(pronunciationGuideColor);
    });

    it("update only font size", () => {
        AppState.resetInstance();
        const appState: AppState = AppState.instance;
        appState.uiState.setFontFamily("Comic Sans MS");
        appState.uiState.setQuestionFontSize(16);
        showFontDialog(appState);

        FontDialogController.changePendingSize("40");
        FontDialogController.update();

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.questionFontSize).to.equal(40);
        expect(appState.uiState.fontFamily.startsWith("Comic Sans MS")).to.be.true;
    });

    it("update only font family", () => {
        AppState.resetInstance();
        const appState: AppState = AppState.instance;
        appState.uiState.setFontFamily("Comic Sans MS");
        appState.uiState.setQuestionFontSize(40);
        showFontDialog(appState);

        FontDialogController.changeFontFamily("Arial");
        FontDialogController.update();

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.questionFontSize).to.equal(40);
        expect(appState.uiState.fontFamily.startsWith("Arial")).to.be.true;
    });

    it("update all", () => {
        const { appState } = initializeApp();

        FontDialogController.changePendingSize("40");
        FontDialogController.changeFontFamily("Comic Sans MS");
        FontDialogController.changeTextColor("black");
        FontDialogController.changePronunciationGuideColor("blue");
        FontDialogController.update();

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontSize).to.be.undefined;
        expect(appState.uiState.questionFontSize).to.equal(40);
        expect(appState.uiState.fontFamily.startsWith("Comic Sans MS")).to.be.true;
        expect(appState.uiState.questionFontColor).to.equal("black");
        expect(appState.uiState.pronunciationGuideColor).to.equal("blue");
    });

    it("resest question text color", () => {
        AppState.resetInstance();
        const appState: AppState = AppState.instance;
        appState.uiState.setQuestionFontColor("black");
        showFontDialog(appState);

        FontDialogController.changeTextColor(undefined);
        FontDialogController.update();

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.questionFontColor).to.be.undefined;
    });

    it("resest pronunciation guide color", () => {
        AppState.resetInstance();
        const appState: AppState = AppState.instance;
        appState.uiState.setPronunciationGuideColor("purple");
        showFontDialog(appState);

        FontDialogController.changePronunciationGuideColor(undefined);
        FontDialogController.update();

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.pronunciationGuideColor).to.be.undefined;
    });

    it("hideDialog", () => {
        const { appState, dialogState } = initializeApp();
        expect(dialogState.fontSize).to.not.be.undefined;

        FontDialogController.cancel();

        expect(appState.uiState.dialogState.fontDialog?.fontFamily).to.be.undefined;
        expect(appState.uiState.dialogState.fontDialog?.fontSize).to.be.undefined;
    });
});
