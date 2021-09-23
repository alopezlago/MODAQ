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

import { AppState } from "src/state/AppState";
import { StateContext } from "src/contexts/StateContext";
import { IMessageDialogState, MessageDialogType } from "src/state/IMessageDialogState";

const modalProps: IModalProps = {
    isBlocking: false,
    dragOptions: {
        moveMenuItemText: "Move",
        closeMenuItemText: "Close",
        menu: ContextualMenu,
    },
    styles: {
        main: {
            top: "25vh",
        },
    },
    topOffsetFixed: true,
};

export const MessageDialog = observer(
    (): JSX.Element => {
        const appState: AppState = React.useContext(StateContext);
        const closeHandler = React.useCallback(() => hideDialog(appState), [appState]);

        const messageDialog: IMessageDialogState | undefined = appState.uiState.dialogState.messageDialog;

        const okHandler = () => {
            if (messageDialog?.onOK !== undefined) {
                messageDialog.onOK();
            }

            hideDialog(appState);
        };

        const dialogContent: IDialogContentProps = {
            type: DialogType.normal,
            title: messageDialog?.title,
            closeButtonAriaLabel: "Close",
            showCloseButton: true,
        };

        const cancelButton: JSX.Element | undefined =
            messageDialog?.type === MessageDialogType.OK ? undefined : (
                <DefaultButton text="Cancel" onClick={closeHandler} />
            );

        return (
            <Dialog
                hidden={messageDialog == undefined}
                dialogContentProps={dialogContent}
                modalProps={modalProps}
                maxWidth="30vw"
                onDismiss={closeHandler}
            >
                <Label>{messageDialog?.message}</Label>
                <DialogFooter>
                    <PrimaryButton text="OK" onClick={okHandler} />
                    {cancelButton}
                </DialogFooter>
            </Dialog>
        );
    }
);

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideMessageDialog();
}
