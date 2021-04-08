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
import { observer } from "mobx-react-lite";
import {
    Separator,
    Stack,
    mergeStyleSets,
    Pivot,
    PivotItem,
    StackItem,
    TextField,
    Label,
    ITextFieldStyles,
    assertNever,
} from "@fluentui/react";

import * as GameFormats from "src/state/GameFormats";
import * as NewGameValidator from "src/state/NewGameValidator";
import * as PendingNewGameUtils from "src/state/PendingNewGameUtils";
import * as Sheets from "src/sheets/Sheets";
import { UIState } from "src/state/UIState";
import { PacketLoader } from "../PacketLoader";
import { GameState } from "src/state/GameState";
import { PacketState } from "src/state/PacketState";
import { ManualTeamEntry } from "../ManualTeamEntry";
import { Player } from "src/state/TeamState";
import { IPendingNewGame, PendingGameType } from "src/state/IPendingNewGame";
import { AppState } from "src/state/AppState";
import { FromRostersTeamEntry } from "../FromRostersTeamEntry";
import { SheetType } from "src/state/SheetState";

const playerListHeight = "25vh";

const enum PivotKey {
    Manual = "M",
    Lifsheets = "L",
    TJSheets = "T",
    UCSDSheets = "U",
}

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
            top: "10vh",
        },
    },
};

const rostersInputStyles: Partial<ITextFieldStyles> = { root: { marginRight: 10, width: "75%" } };

export const NewGameDialog = observer(
    (props: INewGameDialogProps): JSX.Element => {
        const submitHandler = React.useCallback(() => onSubmit(props), [props]);
        const cancelHandler = React.useCallback(() => onCancel(props), [props]);

        return (
            <Dialog
                hidden={!props.appState.uiState.dialogState.newGameDialogVisible}
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
        const classes: INewGameDialogBodyClassNames = getClassNames();
        const uiState: UIState = props.appState.uiState;

        const packetLoadHandler = React.useCallback(
            (packet: PacketState) => {
                if (uiState.pendingNewGame) {
                    uiState.pendingNewGame.packet = packet;
                }
            },
            [uiState]
        );

        const pivotClickHandler = React.useCallback(
            (item?: PivotItem) => {
                if (item == undefined) {
                    return;
                }

                let newGameType: PendingGameType = PendingGameType.Manual;
                const itemPivotKey = item.props.itemKey as PivotKey;
                switch (itemPivotKey) {
                    case PivotKey.Manual:
                    case undefined:
                        newGameType = PendingGameType.Manual;
                        break;
                    case PivotKey.Lifsheets:
                        newGameType = PendingGameType.Lifsheets;
                        break;
                    case PivotKey.TJSheets:
                        newGameType = PendingGameType.TJSheets;
                        break;
                    case PivotKey.UCSDSheets:
                        newGameType = PendingGameType.UCSDSheets;
                        break;
                    default:
                        assertNever(itemPivotKey);
                }

                uiState.setPendingNewGameType(newGameType);
            },
            [uiState]
        );

        // TODO: Have a selector for the format. Will need a way to specify a custom format
        return (
            <>
                <Pivot aria-label="Game type" onLinkClick={pivotClickHandler}>
                    <PivotItem headerText="Manual" itemKey={PivotKey.Manual}>
                        <ManualNewGamePivotBody appState={props.appState} classes={classes} />
                    </PivotItem>
                    <PivotItem headerText="From Lifsheets" itemKey={PivotKey.Lifsheets}>
                        <FromSheetsNewGameBody appState={props.appState} classes={classes} />
                    </PivotItem>
                    <PivotItem headerText="From TJ Sheets" itemKey={PivotKey.TJSheets}>
                        <FromSheetsNewGameBody appState={props.appState} classes={classes} />
                    </PivotItem>
                    <PivotItem headerText="From UCSD Sheets" itemKey={PivotKey.UCSDSheets}>
                        <FromSheetsNewGameBody appState={props.appState} classes={classes} />
                    </PivotItem>
                </Pivot>
                <Separator />
                <PacketLoader appState={props.appState} onLoad={packetLoadHandler} />
                <Separator />
            </>
        );
    }
);

const ManualNewGamePivotBody = observer(
    (props: INewGamePivotItemProps): JSX.Element => {
        const uiState: UIState = props.appState.uiState;

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
            if (uiState.pendingNewGame == undefined || uiState.pendingNewGame.type !== PendingGameType.Manual) {
                return undefined;
            }

            return NewGameValidator.playerTeamsUnique(
                uiState.pendingNewGame.firstTeamPlayers,
                uiState.pendingNewGame.secondTeamPlayers
            );
        }, [uiState.pendingNewGame]);

        const pendingNewGame: IPendingNewGame | undefined = uiState.pendingNewGame;
        if (pendingNewGame?.type !== PendingGameType.Manual) {
            return <></>;
        }

        const teamNameErrorMessage = NewGameValidator.playerTeamsUnique(
            pendingNewGame.firstTeamPlayers,
            pendingNewGame.secondTeamPlayers
        );

        return (
            <Stack>
                <div className={props.classes.teamEntriesContainer}>
                    <ManualTeamEntry
                        defaultTeamName={pendingNewGame.firstTeamPlayers[0].teamName}
                        playerListHeight={playerListHeight}
                        players={pendingNewGame.firstTeamPlayers}
                        teamNameErrorMessage={teamNameErrorMessage}
                        teamLabel="First team"
                        onAddPlayerClick={addPlayerHandler}
                        onRemovePlayerClick={removePlayerHandler}
                        validateTeamName={teamNameValidationHandler}
                    />
                    <Separator vertical={true} />
                    <ManualTeamEntry
                        defaultTeamName={pendingNewGame.secondTeamPlayers[0].teamName}
                        playerListHeight={playerListHeight}
                        players={pendingNewGame.secondTeamPlayers}
                        teamNameErrorMessage={teamNameErrorMessage}
                        teamLabel="Second team"
                        onAddPlayerClick={addPlayerHandler}
                        onRemovePlayerClick={removePlayerHandler}
                        validateTeamName={teamNameValidationHandler}
                    />
                </div>
            </Stack>
        );
    }
);

const FromSheetsNewGameBody = observer(
    (props: INewGamePivotItemProps): JSX.Element => {
        const uiState: UIState = props.appState.uiState;

        const rostersUrlChangeHandler = React.useCallback(
            (ev, newValue: string | undefined) => {
                if (newValue != undefined) {
                    uiState.setPendingNewGameRostersUrl(newValue);
                }
            },
            [uiState]
        );

        const loadHandler = React.useCallback(() => {
            if (uiState.pendingNewGame == undefined || uiState.pendingNewGame.type === PendingGameType.Manual) {
                return;
            }

            const url: string | undefined = uiState.pendingNewGame?.rostersUrl;
            if (url == undefined) {
                return;
            }

            const sheetsId: string | undefined = Sheets.getSheetsId(url);
            if (sheetsId == undefined) {
                return;
            }

            let sheetType: SheetType = SheetType.Lifsheets;
            const pendingNewGameType: PendingGameType = uiState.pendingNewGame.type;
            switch (pendingNewGameType) {
                case undefined:
                case PendingGameType.Lifsheets:
                    sheetType = SheetType.Lifsheets;
                    break;
                case PendingGameType.TJSheets:
                    sheetType = SheetType.TJSheets;
                    break;
                case PendingGameType.UCSDSheets:
                    sheetType = SheetType.UCSDSheets;
                    break;
                default:
                    assertNever(pendingNewGameType);
            }

            uiState.sheetsState.setSheetId(sheetsId);
            uiState.sheetsState.setSheetType(sheetType);
            Sheets.loadRosters(props.appState);
        }, [props, uiState]);

        const teamChangeHandler = React.useCallback(
            (newTeamName: string, oldPlayers: Player[]): void => {
                if (uiState.pendingNewGame == undefined || uiState.pendingNewGame.type === PendingGameType.Manual) {
                    return;
                }

                // If rosters exist, then so do the players, so we can do strict equality to see which team needs to be updated
                if (oldPlayers === uiState.pendingNewGame?.firstTeamPlayersFromRosters) {
                    uiState.setPendingNewGameFirstTeamPlayers(
                        uiState.pendingNewGame.playersFromRosters?.filter(
                            (player) => player.teamName === newTeamName
                        ) ?? []
                    );
                } else if (oldPlayers === uiState.pendingNewGame?.secondTeamPlayersFromRosters) {
                    uiState.setPendingNewGameSecondTeamPlayers(
                        uiState.pendingNewGame.playersFromRosters?.filter(
                            (player) => player.teamName === newTeamName
                        ) ?? []
                    );
                }
            },
            [uiState]
        );

        const pendingNewGame: IPendingNewGame | undefined = uiState.pendingNewGame;
        if (pendingNewGame == undefined || pendingNewGame.type === PendingGameType.Manual) {
            return <></>;
        }

        // We should only do this if we have any players from the rosters
        const teamNameErrorMessage = NewGameValidator.playerTeamsUnique(
            pendingNewGame.firstTeamPlayersFromRosters ?? [],
            pendingNewGame.secondTeamPlayersFromRosters ?? []
        );

        const playersFromRosters: Player[] = pendingNewGame.playersFromRosters ?? [];

        return (
            <Stack>
                <StackItem>
                    <div className={props.classes.loadContainer}>
                        <TextField
                            styles={rostersInputStyles}
                            label="URL to room scoresheet"
                            value={pendingNewGame.rostersUrl}
                            onChange={rostersUrlChangeHandler}
                        />
                        <DefaultButton text="Load" onClick={loadHandler}></DefaultButton>
                    </div>
                    <Label>{props.appState.uiState.sheetsState?.rosterLoadStatus?.status}</Label>
                </StackItem>
                <Separator />
                <StackItem>
                    <div className={props.classes.teamEntriesContainer}>
                        <FromRostersTeamEntry
                            playerListHeight={playerListHeight}
                            playerPool={playersFromRosters}
                            players={pendingNewGame.firstTeamPlayersFromRosters ?? []}
                            teamLabel="First team"
                            onTeamChange={teamChangeHandler}
                        />
                        <Separator vertical={true} />
                        <FromRostersTeamEntry
                            playerListHeight={playerListHeight}
                            playerPool={playersFromRosters}
                            players={pendingNewGame.secondTeamPlayersFromRosters ?? []}
                            teamNameErrorMessage={teamNameErrorMessage}
                            teamLabel="Second team"
                            onTeamChange={teamChangeHandler}
                        />
                    </div>
                </StackItem>
            </Stack>
        );
    }
);

function onAddPlayer(props: INewGameDialogProps, players: Player[]): void {
    const uiState: UIState = props.appState.uiState;

    if (uiState.pendingNewGame?.type === PendingGameType.Manual) {
        // TODO: Use the format to determine if they are a starter
        const teamName: string = players[0].teamName;
        const newPlayer: Player = new Player("", teamName, players.length < 4);

        if (players === uiState.pendingNewGame.firstTeamPlayers) {
            uiState.addPlayerToFirstTeamInPendingNewGame(newPlayer);
        } else {
            uiState.addPlayerToSecondTeamInPendingNewGame(newPlayer);
        }
    }
}

function onRemovePlayer(props: INewGameDialogProps, player: Player): void {
    const uiState: UIState = props.appState.uiState;

    if (uiState.pendingNewGame?.type === PendingGameType.Manual) {
        if (player.teamName === uiState.pendingNewGame.firstTeamPlayers[0].teamName) {
            uiState.removePlayerToFirstTeamInPendingNewGame(player);
        } else {
            uiState.removePlayerToSecondTeamInPendingNewGame(player);
        }
    }
}

// We need this to recreate the game, so we may need to add more methods to it
function onSubmit(props: INewGameDialogProps): void {
    const uiState: UIState = props.appState.uiState;

    if (uiState.pendingNewGame == undefined) {
        throw new Error("Tried creating a new game with no pending game");
    }

    const pendingNewGame: IPendingNewGame = uiState.pendingNewGame;

    const [firstTeamPlayers, secondTeamPlayers]: Player[][] = PendingNewGameUtils.getPendingNewGamePlayers(
        pendingNewGame
    );

    // Trim all the player names now
    for (const player of firstTeamPlayers.concat(secondTeamPlayers)) {
        player.setName(player.name.trim());
    }

    // TODO: Improve validation by return an error message specifying which field is bad. For example, no players in
    // one team isn't reported
    if (!NewGameValidator.isValid(pendingNewGame)) {
        return;
    }

    // We need to set the game's packet, players, etc. to the values in the uiState
    const game: GameState = props.appState.game;
    game.clear();
    game.addPlayers(firstTeamPlayers.filter((player) => player.name !== ""));
    game.addPlayers(secondTeamPlayers.filter((player) => player.name !== ""));
    game.loadPacket(pendingNewGame.packet);

    // TODO: Set the format from the user interface
    game.setGameFormat(GameFormats.UndefinedGameFormat);

    // If we've just started a new game, start at the beginning
    uiState.setCycleIndex(0);

    // If we're manually entering names, clear the sheetsId field, since we don't have a scoresheet for this game
    if (pendingNewGame.type === PendingGameType.Manual) {
        uiState.resetSheetsId();
    }

    // We always want to reset the round number, since this could be for a different round
    uiState.sheetsState.clearRoundNumber();

    hideDialog(props);
}

function onCancel(props: INewGameDialogProps): void {
    hideDialog(props);
}

function hideDialog(props: INewGameDialogProps): void {
    props.appState.uiState.dialogState.hideNewGameDialog();
    props.appState.uiState.resetPendingNewGame();
}

export interface INewGameDialogProps {
    appState: AppState;
}

interface INewGamePivotItemProps extends INewGameDialogProps {
    classes: INewGameDialogBodyClassNames;
}

interface INewGameDialogBodyClassNames {
    loadContainer: string;
    teamEntriesContainer: string;
    teamNameInput: string;
}

const getClassNames = (): INewGameDialogBodyClassNames =>
    mergeStyleSets({
        loadContainer: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
        },
        teamEntriesContainer: {
            // Grid should be more resize friendly than flex if we ever do responsive design
            display: "grid",
            gridTemplateColumns: "5fr 1fr 5fr",
            marginBottom: 20,
            height: "40vh",
            width: "50vw",
        },
        teamNameInput: {
            marginBottom: "10px",
        },
    });
