import * as React from "react";
import { observer } from "mobx-react-lite";
import { Dropdown, TextField, IDropdownOption, DialogFooter, PrimaryButton, DefaultButton } from "@fluentui/react";

import * as AddPlayerDialogController from "../../components/dialogs/AddPlayerDialogController";
import { IPlayer } from "../../state/TeamState";
import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const AddPlayerDialog = observer(function AddPlayerDialog(): JSX.Element {
    return (
        <ModalDialog
            title="Add Player"
            visibilityStatus={ModalVisibilityStatus.AddPlayer}
            onDismiss={AddPlayerDialogController.hideDialog}
        >
            <AddPlayerDialogBody />
            <DialogFooter>
                <PrimaryButton text="Add" onClick={AddPlayerDialogController.addPlayer} />
                <DefaultButton text="Cancel" onClick={AddPlayerDialogController.hideDialog} />
            </DialogFooter>
        </ModalDialog>
    );
});

const AddPlayerDialogBody = observer(function AddPlayerDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const teamChangeHandler = React.useCallback((ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option?.text != undefined) {
            AddPlayerDialogController.changeTeamName(option.text);
        }
    }, []);

    const nameChangeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            AddPlayerDialogController.changePlayerName(newValue ?? ""),
        []
    );

    const newPlayer: IPlayer | undefined = appState.uiState.pendingNewPlayer;
    if (newPlayer === undefined) {
        return <></>;
    }

    const teamOptions: IDropdownOption[] = appState.game.teamNames.map((teamName, index) => {
        return {
            key: index,
            text: teamName,
            selected: newPlayer.teamName === teamName,
        };
    });

    return (
        <>
            <Dropdown label="Team" options={teamOptions} onChange={teamChangeHandler} />
            <TextField
                label="Name"
                value={newPlayer.name}
                required={true}
                onChange={nameChangeHandler}
                onGetErrorMessage={AddPlayerDialogController.validatePlayer}
                validateOnFocusOut={true}
                validateOnLoad={false}
            />
        </>
    );
});
