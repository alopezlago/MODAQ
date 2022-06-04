import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    Dropdown,
    TextField,
    IDropdownOption,
    IDialogContentProps,
    DialogType,
    IModalProps,
    ContextualMenu,
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
} from "@fluentui/react";

import * as AddPlayerDialogController from "../../components/dialogs/AddPlayerDialogController";
import { IPlayer } from "../../state/TeamState";
import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Add Player",
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
    styles: {
        main: {
            top: "25vh",
        },
    },
    topOffsetFixed: true,
};

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const AddPlayerDialog = observer(function AddPlayerDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const submitHandler = React.useCallback(() => AddPlayerDialogController.addPlayer(appState), [appState]);
    const cancelHandler = React.useCallback(() => AddPlayerDialogController.hideDialog(appState), [appState]);

    return (
        <Dialog
            hidden={appState.uiState.pendingNewPlayer === undefined}
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={cancelHandler}
        >
            <AddPlayerDialogBody />
            <DialogFooter>
                <PrimaryButton text="Add" onClick={submitHandler} />
                <DefaultButton text="Cancel" onClick={cancelHandler} />
            </DialogFooter>
        </Dialog>
    );
});

const AddPlayerDialogBody = observer(function AddPlayerDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const teamChangeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
            if (option?.text != undefined) {
                AddPlayerDialogController.changeTeamName(appState, option.text);
            }
        },
        [appState]
    );

    const nameChangeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            AddPlayerDialogController.changePlayerName(appState, newValue ?? ""),
        [appState]
    );

    const onGetErrorMessageHandler = React.useCallback(
        (): string | undefined => AddPlayerDialogController.validatePlayer(appState),
        [appState]
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
                onGetErrorMessage={onGetErrorMessageHandler}
                validateOnFocusOut={true}
                validateOnLoad={false}
            />
        </>
    );
});
