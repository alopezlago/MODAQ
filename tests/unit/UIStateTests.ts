import { expect } from "chai";

import { AppState } from "src/state/AppState";
import { Cycle } from "src/state/Cycle";
import { MessageDialogType } from "src/state/IMessageDialogState";
import { IViewSettings } from "src/state/IViewSettings";
import { ModalVisibilityStatus } from "src/state/ModalVisibilityStatus";
import { Player } from "src/state/TeamState";

describe("UIStateTests", () => {
    describe("showRemoveBonusProtestDialog", () => {
        it("remove callback removes the protest", () => {
            const appState: AppState = new AppState();
            const cycle: Cycle = new Cycle();
            cycle.correctBuzz = {
                tossupIndex: 2,
                marker: { player: new Player("Alice", "Alpha", true), position: 17, points: 10 },
            };
            cycle.addBonusProtest(2, 1, "alpha answer", "alpha reason", "Alpha");

            appState.uiState.showRemoveBonusProtestDialog(cycle, 1);

            const messageDialog = appState.uiState.dialogState.messageDialog;
            if (messageDialog == undefined || messageDialog.onOK == undefined) {
                throw new Error("Remove bonus protest dialog was missing the remove callback");
            }

            expect(appState.uiState.dialogState.visibleDialog).to.equal(ModalVisibilityStatus.Message);
            expect(messageDialog.type).to.equal(MessageDialogType.YesNocCancel);
            expect(messageDialog.yesLabel).to.equal("Remove");
            expect(messageDialog.noLabel).to.equal("Edit");

            messageDialog.onOK();

            expect(cycle.bonusProtests).to.be.undefined;
        });

        it("edit callback reopens the protest with existing values", () => {
            const appState: AppState = new AppState();
            const cycle: Cycle = new Cycle();
            cycle.correctBuzz = {
                tossupIndex: 2,
                marker: { player: new Player("Alice", "Alpha", true), position: 17, points: 10 },
            };
            cycle.addBonusProtest(2, 1, "alpha answer", "alpha reason", "Alpha");

            appState.uiState.showRemoveBonusProtestDialog(cycle, 1);

            const messageDialog = appState.uiState.dialogState.messageDialog;
            if (messageDialog == undefined || messageDialog.onNo == undefined) {
                throw new Error("Remove bonus protest dialog was missing the edit callback");
            }

            messageDialog.onNo();

            const pendingProtest = appState.uiState.pendingBonusProtestEvent;
            expect(appState.uiState.dialogState.visibleDialog).to.equal(ModalVisibilityStatus.BonusProtest);
            expect(pendingProtest).to.not.be.undefined;

            if (pendingProtest == undefined) {
                throw new Error("Pending bonus protest was undefined after choosing edit");
            }

            expect(pendingProtest.teamName).to.equal("Alpha");
            expect(pendingProtest.questionIndex).to.equal(2);
            expect(pendingProtest.partIndex).to.equal(1);
            expect(pendingProtest.givenAnswer).to.equal("alpha answer");
            expect(pendingProtest.reason).to.equal("alpha reason");
        });
    });

    describe("showRemoveTossupProtestDialog", () => {
        it("remove callback removes the protest", () => {
            const appState: AppState = new AppState();
            const cycle: Cycle = new Cycle();
            cycle.addTossupProtest("Alpha", 2, 17, "alpha answer", "alpha reason");

            appState.uiState.showRemoveTossupProtestDialog(cycle, "Alpha");

            const messageDialog = appState.uiState.dialogState.messageDialog;
            if (messageDialog == undefined || messageDialog.onOK == undefined) {
                throw new Error("Remove tossup protest dialog was missing the remove callback");
            }

            expect(appState.uiState.dialogState.visibleDialog).to.equal(ModalVisibilityStatus.Message);
            expect(messageDialog.type).to.equal(MessageDialogType.YesNocCancel);
            expect(messageDialog.yesLabel).to.equal("Remove");
            expect(messageDialog.noLabel).to.equal("Edit");

            messageDialog.onOK();

            expect(cycle.tossupProtests).to.be.undefined;
        });

        it("edit callback reopens the protest with existing values", () => {
            const appState: AppState = new AppState();
            const cycle: Cycle = new Cycle();
            cycle.addTossupProtest("Alpha", 2, 17, "alpha answer", "alpha reason");

            appState.uiState.showRemoveTossupProtestDialog(cycle, "Alpha");

            const messageDialog = appState.uiState.dialogState.messageDialog;
            if (messageDialog == undefined || messageDialog.onNo == undefined) {
                throw new Error("Remove tossup protest dialog was missing the edit callback");
            }

            messageDialog.onNo();

            const pendingProtest = appState.uiState.pendingTossupProtestEvent;
            expect(appState.uiState.dialogState.visibleDialog).to.equal(ModalVisibilityStatus.TossupProtest);
            expect(pendingProtest).to.not.be.undefined;

            if (pendingProtest == undefined) {
                throw new Error("Pending tossup protest was undefined after choosing edit");
            }

            expect(pendingProtest.teamName).to.equal("Alpha");
            expect(pendingProtest.questionIndex).to.equal(2);
            expect(pendingProtest.position).to.equal(17);
            expect(pendingProtest.givenAnswer).to.equal("alpha answer");
            expect(pendingProtest.reason).to.equal("alpha reason");
        });
    });

    describe("setViewSettings", () => {
        it("applies every field as-is", () => {
            const appState: AppState = new AppState();
            const settings: IViewSettings = {
                isClockHidden: true,
                isEventLogHidden: true,
                isPacketNameHidden: true,
                isCustomExportStatusHidden: true,
                isScoreVertical: true,
                noBonusHighlight: true,
                hideBonusOnDeadTossup: true,
                useDarkMode: true,
                fontFamily: "Arial, sans-serif",
                questionFontSize: 24,
                questionFontColor: "#111111",
                pronunciationGuideColor: "#222222",
            };

            appState.uiState.setViewSettings(settings);

            expect(appState.uiState.viewSettings).to.deep.equal(settings);
        });

        it("only changes the fields that are passed in", () => {
            const appState: AppState = new AppState();
            const defaults: IViewSettings = appState.uiState.viewSettings;

            appState.uiState.setViewSettings({ useDarkMode: true, questionFontSize: 20 });

            expect(appState.uiState.viewSettings).to.deep.equal({
                ...defaults,
                useDarkMode: true,
                questionFontSize: 20,
            });
        });

        it("sets false values instead of toggling", () => {
            const appState: AppState = new AppState();
            appState.uiState.toggleClockVisibility();
            appState.uiState.toggleDarkMode();

            appState.uiState.setViewSettings({ isClockHidden: false, useDarkMode: false });
            appState.uiState.setViewSettings({ isClockHidden: false, useDarkMode: false });

            expect(appState.uiState.isClockHidden).to.be.false;
            expect(appState.uiState.useDarkMode).to.be.false;
        });

        it("explicit undefined colors reset to the theme's colors", () => {
            const appState: AppState = new AppState();
            appState.uiState.setQuestionFontColor("#111111");
            appState.uiState.setPronunciationGuideColor("#222222");

            appState.uiState.setViewSettings({ questionFontColor: undefined, pronunciationGuideColor: undefined });

            expect(appState.uiState.questionFontColor).to.be.undefined;
            expect(appState.uiState.pronunciationGuideColor).to.be.undefined;
        });

        it("ignores an empty font family and non-positive font size", () => {
            const appState: AppState = new AppState();
            const defaults: IViewSettings = appState.uiState.viewSettings;

            appState.uiState.setViewSettings({ fontFamily: " ", questionFontSize: 0 });

            expect(appState.uiState.fontFamily).to.equal(defaults.fontFamily);
            expect(appState.uiState.questionFontSize).to.equal(defaults.questionFontSize);
        });

        it("font family from setFontFamily round-trips unchanged", () => {
            const appState: AppState = new AppState();
            appState.uiState.setFontFamily("Arial");
            const fontFamily: string = appState.uiState.viewSettings.fontFamily;

            const otherAppState: AppState = new AppState();
            otherAppState.uiState.setViewSettings({ fontFamily });

            expect(otherAppState.uiState.fontFamily).to.equal(fontFamily);
        });
    });
});
