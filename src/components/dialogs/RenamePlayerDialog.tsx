import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    TextField,
    IDialogContentProps,
    DialogType,
    IModalProps,
    ContextualMenu,
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    Label,
} from "@fluentui/react";

import * as RenamePlayerDialogController from "../../components/dialogs/RenamePlayerDialogController";
import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";
import { RenamePlayerDialogState } from "../../state/RenamePlayerDialogState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Rename Player",
    closeButtonAriaLabel: "Close",
    showCloseButton: true,
    styles: {
        innerContent: {
            display: "flex",
            flexDirection: "column",
        },
    },
};

const modalProps: IModalProps = {
    isBlocking: false,
    dragOptions: {
        moveMenuItemText: "Move",
        closeMenuItemText: "Close",
        menu: ContextualMenu,
    },
    topOffsetFixed: true,
};

export const RenamePlayerDialog = observer(function RenamePlayerDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    return (
        <Dialog
            hidden={appState.uiState.dialogState.visibleDialog !== ModalVisibilityStatus.RenamePlayer}
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={RenamePlayerDialogController.hideDialog}
        >
            <RenamePlayerDialogBody />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={RenamePlayerDialogController.renamePlayer} />
                <DefaultButton text="Cancel" onClick={RenamePlayerDialogController.hideDialog} />
            </DialogFooter>
        </Dialog>
    );
});

const RenamePlayerDialogBody = observer(function RenamePlayerDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const renamePlayerDialog: RenamePlayerDialogState | undefined = appState.uiState.dialogState.renamePlayerDialog;
    if (renamePlayerDialog === undefined) {
        return <></>;
    }

    const player: Player = renamePlayerDialog.player;
    return (
        <>
            <Label>{`Rename ${player.name} (${player.teamName}) to:`}</Label>
            <TextField
                autoFocus={true}
                label="Name"
                value={renamePlayerDialog.newName}
                required={true}
                onChange={onNameChange}
                onGetErrorMessage={RenamePlayerDialogController.validatePlayer}
                validateOnFocusOut={true}
                validateOnLoad={false}
            />
        </>
    );
});

function onNameChange(ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) {
    RenamePlayerDialogController.changeNewName(newValue ?? "");
}
