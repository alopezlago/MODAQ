import * as React from "react";
import { observer } from "mobx-react-lite";
import { TextField, DialogFooter, PrimaryButton, DefaultButton, Label } from "@fluentui/react";

import * as RenamePlayerDialogController from "../../components/dialogs/RenamePlayerDialogController";
import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";
import { useAppState } from "../../contexts/StateContext";
import { RenamePlayerDialogState } from "../../state/RenamePlayerDialogState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

export const RenamePlayerDialog = observer(function RenamePlayerDialog(): JSX.Element {
    const appState: AppState = useAppState();

    return (
        <ModalDialog
            title="Rename Player"
            visibilityStatus={ModalVisibilityStatus.RenamePlayer}
            onDismiss={() => RenamePlayerDialogController.hideDialog(appState)}
        >
            <RenamePlayerDialogBody appState={appState} />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={() => RenamePlayerDialogController.renamePlayer(appState)} />
                <DefaultButton text="Cancel" onClick={() => RenamePlayerDialogController.hideDialog(appState)} />
            </DialogFooter>
        </ModalDialog>
    );
});

const RenamePlayerDialogBody = observer(function RenamePlayerDialogBody(
    props: IRenamePlayerDialogBodyProps
): JSX.Element {
    const appState: AppState = props.appState;

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
                onChange={(ev, newValue) => onNameChange(appState, ev, newValue)}
                onGetErrorMessage={() => RenamePlayerDialogController.validatePlayer(appState)}
                validateOnFocusOut={true}
                validateOnLoad={false}
            />
        </>
    );
});

function onNameChange(
    appState: AppState,
    ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
) {
    RenamePlayerDialogController.changeNewName(appState, newValue ?? "");
}

interface IRenamePlayerDialogBodyProps {
    appState: AppState;
}
