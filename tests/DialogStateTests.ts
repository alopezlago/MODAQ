import { expect } from "chai";

import { DialogState } from "src/state/DialogState";
import { MessageDialogType } from "src/state/IMessageDialogState";
import { ModalVisibilityStatus } from "src/state/ModalVisibilityStatus";

describe("DialogStateTests", () => {
    it("showOKMessageDialog stores message fields and optional OK label", () => {
        const dialogState: DialogState = new DialogState();

        dialogState.showOKMessageDialog({
            title: "Info",
            message: "Done",
            okLabel: "Got it",
        });

        expect(dialogState.visibleDialog).to.equal(ModalVisibilityStatus.Message);
        expect(dialogState.messageDialog).to.not.be.undefined;

        const messageDialog = dialogState.messageDialog;
        if (messageDialog == undefined) {
            throw new Error("Message dialog was undefined");
        }

        expect(messageDialog.type).to.equal(MessageDialogType.OK);
        expect(messageDialog.title).to.equal("Info");
        expect(messageDialog.message).to.equal("Done");
        expect(messageDialog.okLabel).to.equal("Got it");
        expect(messageDialog.yesLabel).to.be.undefined;
        expect(messageDialog.noLabel).to.be.undefined;
    });

    it("showOKCancelMessageDialog stores callback and optional OK label", () => {
        const dialogState: DialogState = new DialogState();
        let confirmed = false;

        dialogState.showOKCancelMessageDialog({
            title: "Confirm",
            message: "Proceed?",
            onOK: () => {
                confirmed = true;
            },
            okLabel: "Proceed",
        });

        expect(dialogState.visibleDialog).to.equal(ModalVisibilityStatus.Message);
        expect(dialogState.messageDialog).to.not.be.undefined;

        const messageDialog = dialogState.messageDialog;
        if (messageDialog == undefined || messageDialog.onOK == undefined) {
            throw new Error("OK/Cancel message dialog was missing onOK callback");
        }

        expect(messageDialog.type).to.equal(MessageDialogType.OKCancel);
        expect(messageDialog.okLabel).to.equal("Proceed");

        messageDialog.onOK();
        expect(confirmed).to.be.true;
    });

    it("showYesNoCancelMessageDialog stores callbacks and optional labels", () => {
        const dialogState: DialogState = new DialogState();
        let yesClicked = false;
        let noClicked = false;

        dialogState.showYesNoCancelMessageDialog({
            title: "Export?",
            message: "Export before leaving?",
            onYes: () => {
                yesClicked = true;
            },
            onNo: () => {
                noClicked = true;
            },
            yesLabel: "Export",
            noLabel: "Skip",
        });

        expect(dialogState.visibleDialog).to.equal(ModalVisibilityStatus.Message);
        expect(dialogState.messageDialog).to.not.be.undefined;

        const messageDialog = dialogState.messageDialog;
        if (messageDialog == undefined || messageDialog.onOK == undefined || messageDialog.onNo == undefined) {
            throw new Error("Yes/No/Cancel message dialog callbacks were missing");
        }

        expect(messageDialog.type).to.equal(MessageDialogType.YesNocCancel);
        expect(messageDialog.yesLabel).to.equal("Export");
        expect(messageDialog.noLabel).to.equal("Skip");

        messageDialog.onOK();

        expect(yesClicked).to.be.true;
        expect(noClicked).to.be.false;

        messageDialog.onNo();

        expect(yesClicked).to.be.true;
        expect(noClicked).to.be.true;
    });
});
