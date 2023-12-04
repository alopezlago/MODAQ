import * as React from "react";
import { observer } from "mobx-react-lite";
import { TextField, DialogFooter, PrimaryButton, DefaultButton, Label } from "@fluentui/react";

import * as RenamePlayerDialogController from "../../components/dialogs/RenamePlayerDialogController";
import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";
import { RenamePlayerDialogState } from "../../state/RenamePlayerDialogState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

export const RenamePlayerDialog = observer(function RenamePlayerDialog(): JSX.Element {
    return (
        <ModalDialog
            title="Rename Player"
            visibilityStatus={ModalVisibilityStatus.RenamePlayer}
            onDismiss={RenamePlayerDialogController.hideDialog}
        >
            <RenamePlayerDialogBody />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={RenamePlayerDialogController.renamePlayer} />
                <DefaultButton text="Cancel" onClick={RenamePlayerDialogController.hideDialog} />
            </DialogFooter>
        </ModalDialog>
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
