import * as React from "react";
import { observer } from "mobx-react";
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

import * as NewGameValidator from "src/state/NewGameValidator";
import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";
import { Player, IPlayer } from "src/state/TeamState";
import { AppState } from "src/state/AppState";

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
    topOffsetFixed: true,
};

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const AddPlayerDialog = observer(
    (props: INewGameDialogProps): JSX.Element => {
        const submitHandler = React.useCallback(() => onSubmit(props), [props]);
        const cancelHandler = React.useCallback(() => onCancel(props), [props]);

        return (
            <Dialog
                hidden={props.appState.uiState.pendingNewPlayer === undefined}
                dialogContentProps={content}
                modalProps={modalProps}
                onDismiss={cancelHandler}
            >
                <AddPlayerDialogBody {...props} />
                <DialogFooter>
                    <PrimaryButton text="Add" onClick={submitHandler} />
                    <DefaultButton text="Cancel" onClick={cancelHandler} />
                </DialogFooter>
            </Dialog>
        );
    }
);

const AddPlayerDialogBody = observer(
    (props: INewGameDialogProps): JSX.Element => {
        const uiState: UIState = props.appState.uiState;

        const teamChangeHandler = React.useCallback(
            (ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
                if (option?.text != undefined) {
                    uiState.updatePendingNewPlayerTeamName(option.text);
                }
            },
            [uiState]
        );

        const nameChangeHandler = React.useCallback(
            (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
                uiState.updatePendingNewPlayerName(newValue ?? ""),
            [uiState]
        );

        const newPlayer: IPlayer | undefined = uiState.pendingNewPlayer;
        if (newPlayer === undefined) {
            return <></>;
        }

        const teamOptions: IDropdownOption[] = props.appState.game.teamNames.map((teamName, index) => {
            return {
                key: index,
                text: teamName,
                selected: newPlayer.teamName === teamName,
            };
        });

        return (
            <>
                <Dropdown label="Team" options={teamOptions} onChange={teamChangeHandler} />
                <TextField label="Name" value={newPlayer.name} required={true} onChange={nameChangeHandler} />
            </>
        );
    }
);

function onSubmit(props: INewGameDialogProps): void {
    const game: GameState = props.appState.game;
    const uiState: UIState = props.appState.uiState;

    const newPlayer: Player | undefined = uiState.pendingNewPlayer;
    if (newPlayer == undefined) {
        throw new Error("Tried adding a player with no new player");
    }

    // Trim the player name on submit, so the user can type in spaces while creating the name in the UI
    const trimmedPlayerName: string = newPlayer.name.trim();
    if (trimmedPlayerName.length === 0) {
        return;
    }

    uiState.updatePendingNewPlayerName(trimmedPlayerName);

    const playersOnTeam: Player[] = game.getPlayers(newPlayer.teamName);
    if (NewGameValidator.newPlayerNameUnique(playersOnTeam, trimmedPlayerName) !== undefined) {
        return;
    }

    game.addPlayer(newPlayer);

    // TODO: Only do this if the number of active players is less than the maximum number of active players
    game.cycles[uiState.cycleIndex].addPlayerJoins(newPlayer);

    hideDialog(props);
}

function onCancel(props: INewGameDialogProps): void {
    hideDialog(props);
}

function hideDialog(props: INewGameDialogProps): void {
    props.appState.uiState.resetPendingNewPlayer();
}

export interface INewGameDialogProps {
    appState: AppState;
}
