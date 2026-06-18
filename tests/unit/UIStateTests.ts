import { expect } from "chai";

import { AppState } from "src/state/AppState";
import { Cycle } from "src/state/Cycle";
import { MessageDialogType } from "src/state/IMessageDialogState";
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
});
