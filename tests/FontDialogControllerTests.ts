import { expect } from "chai";

import * as FontDialogController from "src/components/dialogs/FontDialogController";
import { AppState } from "src/state/AppState";

function initializeApp(): AppState {
    AppState.resetInstance();
    const appState: AppState = AppState.instance;
    appState.uiState.setPendingFontSize(16);
    return appState;
}

// Need tests for FontDC

describe("FontDialogControllerTests", () => {
    it("changeFontFamily specific font", () => {
        const appState: AppState = initializeApp();

        const newFontFamily = "Comic Sans MS";
        FontDialogController.changeFontFamily(newFontFamily);

        expect(appState.uiState.pendingFontFamily).to.equal(newFontFamily);
    });

    it("changeFontFamily default font", () => {
        const appState: AppState = initializeApp();

        FontDialogController.changeFontFamily(undefined);

        expect(appState.uiState.pendingFontFamily).to.equal(FontDialogController.defaultFont);
    });

    it("changePendingSize", () => {
        const appState: AppState = initializeApp();

        const oldFontSize = appState.uiState.pendingFontSize;
        const newFontSize = (oldFontSize ?? 16) + 8;
        FontDialogController.changePendingSize(newFontSize.toString());

        expect(appState.uiState.pendingFontSize).to.equal(newFontSize);
    });

    it("changePendingSize for invalid value", () => {
        const appState: AppState = initializeApp();

        const oldFontSize = appState.uiState.pendingFontSize;
        FontDialogController.changePendingSize("xyz");

        expect(appState.uiState.pendingFontSize).to.equal(oldFontSize);
    });

    it("update", () => {
        const appState: AppState = initializeApp();

        FontDialogController.changePendingSize("40");
        FontDialogController.changeFontFamily("Comic Sans MS");
        FontDialogController.update();

        expect(appState.uiState.pendingFontFamily).to.be.undefined;
        expect(appState.uiState.pendingFontSize).to.be.undefined;
        expect(appState.uiState.questionFontSize).to.equal(40);
        expect(appState.uiState.fontFamily.startsWith("Comic Sans MS")).to.be.true;
    });

    it("hideDialog", () => {
        const appState: AppState = initializeApp();
        expect(appState.uiState.pendingFontSize).to.not.be.undefined;

        FontDialogController.cancel();

        expect(appState.uiState.pendingFontFamily).to.be.undefined;
        expect(appState.uiState.pendingFontSize).to.be.undefined;
    });
});
