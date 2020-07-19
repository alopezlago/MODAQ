// This dialog should have
// - Reader's name (for use with syncing to the bot later, could be a dropdown then)
// - Two boxes, side by side, for the team name and players
// - Optional dropdown, containing the format rules, which includes
//   - If timeouts are allowed
//   - If subs are allowed
//   - Point values for powers?
//   - Number of tossups in regulation
//     - This should drive the number of cycles we show? We could still create the cycles.
//   - Tiebreaking procedures
//   - Eventually this should use QBSchema's interface for this
//   - For now, always assume ACF
// - A button to pick the packet to choose. Specify that it should be JSON; support for docx may come soon.

import * as React from "react";
import { Dialog, DialogFooter, IDialogContentProps, DialogType } from "@fluentui/react/lib/Dialog";
import { IModalProps } from "@fluentui/react/lib/Modal";
import { ContextualMenu } from "@fluentui/react/lib/ContextualMenu";
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button";
import { createUseStyles } from "react-jss";
import { observer } from "mobx-react";
import { Separator, Stack } from "@fluentui/react";

import * as NewGameValidator from "src/state/NewGameValidator";
import { UIState } from "src/state/UIState";
import { PacketLoader } from "./PacketLoader";
import { GameState } from "src/state/GameState";
import { PacketState } from "src/state/PacketState";
import { TeamEntry } from "./TeamEntry";
import { Player } from "src/state/TeamState";
import { IPendingNewGame } from "src/state/IPendingNewGame";

const playerListHeight = "25vh";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "New Game",
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
    styles: {
        main: {
            // To have max width respected normally, we'd need to pass in an IDialogStyleProps, but it ridiculously
            // requires you to pass in an entire theme to modify the max width. We could also use a modal, but that
            // requires building much of what Dialogs offer easily (close buttons, footer for buttons)
            maxWidth: "80% !important",
        },
    },
};

export const NewGameDialog = observer(
    (props: INewGameDialogProps): JSX.Element => {
        const submitHandler = React.useCallback(() => onSubmit(props), [props]);
        const cancelHandler = React.useCallback(() => onCancel(props), [props]);

        return (
            <Dialog
                hidden={props.uiState.pendingNewGame === undefined}
                dialogContentProps={content}
                modalProps={modalProps}
                onDismiss={cancelHandler}
            >
                <NewGameDialogBody {...props} />
                <DialogFooter>
                    <PrimaryButton text="Start" onClick={submitHandler} />
                    <DefaultButton text="Cancel" onClick={cancelHandler} />
                </DialogFooter>
            </Dialog>
        );
    }
);

const NewGameDialogBody = observer(
    (props: INewGameDialogProps): JSX.Element => {
        const classes: INewGameDialogBodyStyle = useStyles();
        const packetLoadHandler = React.useCallback(
            (packet: PacketState) => {
                if (props.uiState.pendingNewGame) {
                    props.uiState.pendingNewGame.packet = packet;
                }
            },
            [props]
        );

        // If we ever support an arbitrary number of teams, turn this into an array, or find a way to identify which
        // team to upadate (like an index)
        const addPlayerHandler = React.useCallback(
            (existingPlayers: Player[]) => {
                onAddPlayer(props, existingPlayers);
            },
            [props]
        );
        const removePlayerHandler = React.useCallback(
            (player: Player) => {
                onRemovePlayer(props, player);
            },
            [props]
        );
        const teamNameValidationHandler = React.useCallback((): string | undefined => {
            if (props.uiState.pendingNewGame == undefined) {
                return undefined;
            }

            return NewGameValidator.playerTeamsUnique(
                props.uiState.pendingNewGame.firstTeamPlayers,
                props.uiState.pendingNewGame.secondTeamPlayers
            );
        }, [props.uiState.pendingNewGame]);

        const newGame: IPendingNewGame | undefined = props.uiState.pendingNewGame;
        if (newGame === undefined) {
            return <></>;
        }

        const teamNameErrorMessage = NewGameValidator.playerTeamsUnique(
            newGame.firstTeamPlayers,
            newGame.secondTeamPlayers
        );

        return (
            <Stack>
                <div className={classes.teamEntriesContainer}>
                    <TeamEntry
                        defaultTeamName={newGame.firstTeamPlayers[0].teamName}
                        playerListHeight={playerListHeight}
                        players={newGame.firstTeamPlayers}
                        teamNameErrorMessage={teamNameErrorMessage}
                        teamLabel="First team"
                        onAddPlayerClick={addPlayerHandler}
                        onRemovePlayerClick={removePlayerHandler}
                        validateTeamName={teamNameValidationHandler}
                    />
                    <Separator vertical={true} />
                    <TeamEntry
                        defaultTeamName={newGame.secondTeamPlayers[0].teamName}
                        playerListHeight={playerListHeight}
                        players={newGame.secondTeamPlayers}
                        teamNameErrorMessage={teamNameErrorMessage}
                        teamLabel="Second team"
                        onAddPlayerClick={addPlayerHandler}
                        onRemovePlayerClick={removePlayerHandler}
                        validateTeamName={teamNameValidationHandler}
                    />
                </div>
                <PacketLoader uiState={props.uiState} onLoad={packetLoadHandler} />
            </Stack>
        );
    }
);

function onAddPlayer(props: INewGameDialogProps, players: Player[]): void {
    if (props.uiState.pendingNewGame != undefined) {
        // TODO: Use the format to determine if they are a starter
        const teamName: string = players[0].teamName;
        const newPlayer: Player = new Player("", teamName, players.length < 4);

        if (players === props.uiState.pendingNewGame.firstTeamPlayers) {
            props.uiState.addPlayerToFirstTeamInPendingNewGame(newPlayer);
        } else {
            props.uiState.addPlayerToSecondTeamInPendingNewGame(newPlayer);
        }
    }
}

function onRemovePlayer(props: INewGameDialogProps, player: Player): void {
    if (props.uiState.pendingNewGame != undefined) {
        if (player.teamName === props.uiState.pendingNewGame.firstTeamPlayers[0].teamName) {
            props.uiState.removePlayerToFirstTeamInPendingNewGame(player);
        } else {
            props.uiState.removePlayerToSecondTeamInPendingNewGame(player);
        }
    }
}

// We need this to recreate the game, so we may need to add more methods to it
function onSubmit(props: INewGameDialogProps): void {
    if (props.uiState.pendingNewGame == undefined) {
        throw new Error("Tried creating a new game with no pending game");
    }

    // Trim all the player names now
    for (const player of props.uiState.pendingNewGame.firstTeamPlayers.concat(
        props.uiState.pendingNewGame.secondTeamPlayers
    )) {
        player.setName(player.name.trim());
    }

    // TODO: Improve validation by return an error message specifying which field is bad. For example, no players in
    // one team isn't reported
    if (!NewGameValidator.isValid(props.uiState.pendingNewGame)) {
        return;
    }

    // We need to set the game's packet, players, etc. to the values in the uiState
    props.game.clear();
    props.game.addPlayers(props.uiState.pendingNewGame.firstTeamPlayers.filter((player) => player.name !== ""));
    props.game.addPlayers(props.uiState.pendingNewGame.secondTeamPlayers.filter((player) => player.name !== ""));
    props.game.loadPacket(props.uiState.pendingNewGame.packet);

    hideDialog(props);
}

function onCancel(props: INewGameDialogProps): void {
    hideDialog(props);
}

function hideDialog(props: INewGameDialogProps): void {
    props.uiState.resetPendingNewGame();
}

export interface INewGameDialogProps {
    game: GameState;
    uiState: UIState;
}

interface INewGameDialogBodyStyle {
    teamEntriesContainer: string;
    teamNameInput: string;
}

const useStyles: (data?: unknown) => INewGameDialogBodyStyle = createUseStyles({
    teamEntriesContainer: {
        // Grid should be more resize friendly than flex if we ever do responsive design
        display: "grid",
        gridTemplateColumns: "5fr 1fr 5fr",
        marginBottom: 20,
    },
    teamNameInput: {
        marginBottom: "10px",
    },
});
