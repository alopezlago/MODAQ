import React from "react";
import { observer } from "mobx-react-lite";
import {
    Dialog,
    DialogFooter,
    PrimaryButton,
    ContextualMenu,
    DialogType,
    IDialogContentProps,
    IModalProps,
    Label,
    DefaultButton,
} from "@fluentui/react";

import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";
import { IMessageDialogState, MessageDialogType } from "../../state/IMessageDialogState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";

const modalProps: IModalProps = {
    isBlocking: false,
    dragOptions: {
        moveMenuItemText: "Move",
        closeMenuItemText: "Close",
        menu: ContextualMenu,
    },
    topOffsetFixed: true,
};

export const MessageDialog = observer(function MessageDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const closeHandler = React.useCallback(() => hideDialog(appState), [appState]);

    const messageDialog: IMessageDialogState | undefined = appState.uiState.dialogState.messageDialog;

    if (messageDialog == undefined) {
        return <></>;
    }

    const okHandler = () => {
        if (messageDialog.onOK !== undefined) {
            messageDialog.onOK();
        }

        hideDialog(appState);
    };

    const dialogContent: IDialogContentProps = {
        type: DialogType.normal,
        title: messageDialog.title,
        closeButtonAriaLabel: "Close",
        showCloseButton: true,
    };

    const noButton: JSX.Element | undefined =
        messageDialog.type === MessageDialogType.YesNocCancel ? (
            <DefaultButton
                text="No"
                onClick={() => {
                    if (messageDialog.onNo !== undefined) {
                        messageDialog.onNo();
                    }

                    hideDialog(appState);
                }}
            />
        ) : undefined;

    const cancelButton: JSX.Element | undefined =
        messageDialog.type === MessageDialogType.OK ? undefined : (
            <DefaultButton text="Cancel" onClick={closeHandler} />
        );

    const okButtonText = messageDialog.type === MessageDialogType.YesNocCancel ? "Yes" : "OK";

    return (
        <Dialog
            hidden={appState.uiState.dialogState.visibleDialog !== ModalVisibilityStatus.Message}
            dialogContentProps={dialogContent}
            modalProps={modalProps}
            maxWidth="30vw"
            onDismiss={closeHandler}
        >
            <Label>{messageDialog?.message}</Label>
            <DialogFooter>
                <PrimaryButton text={okButtonText} onClick={okHandler} />
                {noButton}
                {cancelButton}
            </DialogFooter>
        </Dialog>
    );
});

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideMessageDialog();
}
