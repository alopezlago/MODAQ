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
    ThemeContext,
    Link,
    IStackItemStyles,
} from "@fluentui/react";

import * as NewGameValidator from "../../state/NewGameValidator";
import * as PendingNewGameUtils from "../../state/PendingNewGameUtils";
import * as PlayerUtils from "../../state/PlayerUtils";
import * as QBJ from "../../qbj/QBJ";
import * as Sheets from "../../sheets/Sheets";
import { UIState } from "../../state/UIState";
import { PacketLoader } from "../PacketLoader";
import { GameState } from "../../state/GameState";
import { PacketState } from "../../state/PacketState";
import { ManualTeamEntry } from "../ManualTeamEntry";
import { Player } from "../../state/TeamState";
import {
    IPendingFromSheetsNewGameState,
    IPendingManualNewGameState,
    IPendingNewGame,
    PendingGameType,
} from "../../state/IPendingNewGame";
import { AppState } from "../../state/AppState";
import { FromRostersTeamEntry } from "../FromRostersTeamEntry";
import { SheetType } from "../../state/SheetState";
import { GameFormatPicker } from "../GameFormatPicker";
import { StateContext } from "../../contexts/StateContext";
import { IGameFormat } from "../../state/IGameFormat";
import { FilePicker } from "../FilePicker";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { IResult } from "../../IResult";

const playerListHeight = "25vh";

const enum PivotKey {
    Manual = "M",
    TJSheets = "T",
    UCSDSheets = "U",
    QBJRegistration = "R",
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
            minWidth: "60% !important",
            maxWidth: "90% !important",
            maxHeight: "95% !important",
            top: "5vh",
        },
    },
};

const rostersInputStyles: Partial<ITextFieldStyles> = { root: { marginRight: 10, width: "75%" } };

const rosterFileLinkStyles: IStackItemStyles = { root: { marginBottom: 10 } };

export const NewGameDialog = observer(function NewGameDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const submitHandler = React.useCallback(() => onSubmit(appState), [appState]);
    const cancelHandler = React.useCallback(() => onCancel(appState), [appState]);

    return (
        <Dialog
            hidden={appState.uiState.dialogState.visibleDialog !== ModalVisibilityStatus.NewGame}
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={cancelHandler}
        >
            {appState.uiState.dialogState.visibleDialog === ModalVisibilityStatus.NewGame && <NewGameDialogBody />}
            <DialogFooter>
                <PrimaryButton text="Start" onClick={submitHandler} />
                <DefaultButton text="Cancel" onClick={cancelHandler} />
            </DialogFooter>
        </Dialog>
    );
});

const NewGameDialogBody = observer(function NewGameDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const classes: INewGameDialogBodyClassNames = getClassNames();
    const uiState: UIState = appState.uiState;

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
                case PivotKey.TJSheets:
                    newGameType = PendingGameType.TJSheets;
                    break;
                case PivotKey.UCSDSheets:
                    newGameType = PendingGameType.UCSDSheets;
                    break;
                case PivotKey.QBJRegistration:
                    newGameType = PendingGameType.QBJRegistration;
                    break;
                default:
                    assertNever(itemPivotKey);
            }

            uiState.setPendingNewGameType(newGameType);
        },
        [uiState]
    );

    const updateGameFormat = React.useCallback(
        (gameFormat: IGameFormat) => appState.uiState.setPendingNewGameFormat(gameFormat),
        [appState]
    );

    if (uiState.pendingNewGame == undefined) {
        return <></>;
    }

    // TODO: Have a selector for the format. Will need a way to specify a custom format
    return (
        <>
            <Pivot
                aria-label="Game type"
                onLinkClick={pivotClickHandler}
                defaultSelectedKey={getDefaultPivotKey(uiState.pendingNewGame?.type)}
            >
                <PivotItem headerText="Manual" itemKey={PivotKey.Manual}>
                    <ManualNewGamePivotBody appState={appState} classes={classes} />
                </PivotItem>
                <PivotItem headerText="From TJ Sheets" itemKey={PivotKey.TJSheets}>
                    <FromSheetsNewGameBody appState={appState} classes={classes} />
                </PivotItem>
                <PivotItem headerText="From UCSD Sheets" itemKey={PivotKey.UCSDSheets}>
                    <FromSheetsNewGameBody appState={appState} classes={classes} />
                </PivotItem>
                <PivotItem headerText="From QBJ Registration" itemKey={PivotKey.QBJRegistration}>
                    <FromQBJRegistrationNewGameBody appState={appState} classes={classes} />
                </PivotItem>
            </Pivot>
            <Separator />
            <PacketLoader appState={appState} onLoad={packetLoadHandler} updateFilename />
            <Separator />
            <GameFormatPicker
                gameFormat={uiState.pendingNewGame.gameFormat}
                exportFormatSupportsBouncebacks={uiState.pendingNewGame.type !== PendingGameType.UCSDSheets}
                updateGameFormat={updateGameFormat}
            />
        </>
    );
});

const ManualNewGamePivotBody = observer(function ManualNewGamePivotBody(props: INewGamePivotItemProps): JSX.Element {
    const uiState: UIState = props.appState.uiState;

    // If we ever support an arbitrary number of teams, turn this into an array, or find a way to identify which
    // team to upadate (like an index)
    const addPlayerHandler = React.useCallback(
        (existingPlayers: Player[]) => {
            onAddPlayer(props.appState, existingPlayers);
        },
        [props.appState]
    );
    const removePlayerHandler = React.useCallback(
        (player: Player) => {
            onRemovePlayer(props.appState, player);
        },
        [props.appState]
    );
    const teamNameValidationHandler = React.useCallback((): string | undefined => {
        if (uiState.pendingNewGame == undefined || uiState.pendingNewGame.type !== PendingGameType.Manual) {
            return undefined;
        }

        return NewGameValidator.playerTeamsUnique(
            uiState.pendingNewGame.manual.firstTeamPlayers,
            uiState.pendingNewGame.manual.secondTeamPlayers
        );
    }, [uiState.pendingNewGame]);

    const pendingNewGame: IPendingNewGame | undefined = uiState.pendingNewGame;
    if (pendingNewGame?.type !== PendingGameType.Manual) {
        return <></>;
    }

    const manualState: IPendingManualNewGameState = pendingNewGame.manual;

    const teamNameErrorMessage = NewGameValidator.playerTeamsUnique(
        manualState.firstTeamPlayers,
        manualState.secondTeamPlayers
    );

    return (
        <Stack>
            <div className={props.classes.teamEntriesContainer}>
                <ManualTeamEntry
                    defaultTeamName={manualState.firstTeamPlayers[0].teamName}
                    playerListHeight={playerListHeight}
                    players={manualState.firstTeamPlayers}
                    teamNameErrorMessage={teamNameErrorMessage}
                    teamLabel="First team"
                    onAddPlayerClick={addPlayerHandler}
                    onRemovePlayerClick={removePlayerHandler}
                    validateTeamName={teamNameValidationHandler}
                />
                <Separator vertical={true} />
                <ManualTeamEntry
                    defaultTeamName={manualState.secondTeamPlayers[0].teamName}
                    playerListHeight={playerListHeight}
                    players={manualState.secondTeamPlayers}
                    teamNameErrorMessage={teamNameErrorMessage}
                    teamLabel="Second team"
                    onAddPlayerClick={addPlayerHandler}
                    onRemovePlayerClick={removePlayerHandler}
                    validateTeamName={teamNameValidationHandler}
                />
            </div>
        </Stack>
    );
});

const FromSheetsNewGameBody = observer(function FromSheetsNewGameBody(props: INewGamePivotItemProps): JSX.Element {
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

        if (uiState.pendingNewGame.type === PendingGameType.QBJRegistration) {
            return;
        }

        let url: string | undefined;
        let sheetType: SheetType = SheetType.TJSheets;
        switch (uiState.pendingNewGame.type) {
            case undefined:
            case PendingGameType.TJSheets:
                url = uiState.pendingNewGame.tjSheets.rostersUrl;
                sheetType = SheetType.TJSheets;
                break;
            case PendingGameType.UCSDSheets:
                url = uiState.pendingNewGame.ucsdSheets.rostersUrl;
                sheetType = SheetType.UCSDSheets;
                break;
            default:
                assertNever(uiState.pendingNewGame);
        }

        const sheetsId: string | undefined = Sheets.getSheetsId(url);
        if (sheetsId == undefined) {
            return;
        }

        uiState.sheetsState.setSheetId(sheetsId);
        uiState.sheetsState.setSheetType(sheetType);
        Sheets.loadRosters(props.appState);
    }, [props, uiState]);

    const teamChangeHandler = React.useCallback(
        (newTeamName: string, oldPlayers: Player[]): void => {
            if (
                uiState.pendingNewGame == undefined ||
                uiState.pendingNewGame.type === PendingGameType.Manual ||
                uiState.pendingNewGame.type === PendingGameType.QBJRegistration
            ) {
                return;
            }

            const sheetsState: IPendingFromSheetsNewGameState =
                uiState.pendingNewGame.type === PendingGameType.TJSheets
                    ? uiState.pendingNewGame.tjSheets
                    : uiState.pendingNewGame.ucsdSheets;

            // If rosters exist, then so do the players, so we can do strict equality to see which team needs to be updated
            if (oldPlayers === sheetsState.firstTeamPlayersFromRosters) {
                uiState.setPendingNewGameFirstTeamPlayers(
                    sheetsState.playersFromRosters?.filter((player) => player.teamName === newTeamName) ?? []
                );
            } else if (oldPlayers === sheetsState.secondTeamPlayersFromRosters) {
                uiState.setPendingNewGameSecondTeamPlayers(
                    sheetsState.playersFromRosters?.filter((player) => player.teamName === newTeamName) ?? []
                );
            }
        },
        [uiState]
    );

    const pendingNewGame: IPendingNewGame | undefined = uiState.pendingNewGame;
    if (
        pendingNewGame == undefined ||
        pendingNewGame.type === PendingGameType.Manual ||
        pendingNewGame.type === PendingGameType.QBJRegistration
    ) {
        return <></>;
    }

    const sheetsState: IPendingFromSheetsNewGameState =
        pendingNewGame.type === PendingGameType.TJSheets ? pendingNewGame.tjSheets : pendingNewGame.ucsdSheets;

    // We should only do this if we have any players from the rosters
    const teamNameErrorMessage = NewGameValidator.playerTeamsUnique(
        sheetsState.firstTeamPlayersFromRosters ?? [],
        sheetsState.secondTeamPlayersFromRosters ?? []
    );

    const playersFromRosters: Player[] = sheetsState.playersFromRosters ?? [];
    const firstTeamPlayersFromRosters: Player[] = sheetsState.firstTeamPlayersFromRosters ?? [];
    const secondTeamPlayersFromRosters: Player[] = sheetsState.secondTeamPlayersFromRosters ?? [];

    return (
        <Stack>
            <StackItem>
                <div className={props.classes.loadContainer}>
                    <TextField
                        styles={rostersInputStyles}
                        label="URL to room scoresheet"
                        value={sheetsState.rostersUrl}
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
                        players={firstTeamPlayersFromRosters}
                        teamLabel="First team"
                        onMovePlayerBackward={(player) =>
                            uiState.setPendingNewGameFirstTeamPlayers(
                                PlayerUtils.movePlayerBackward(firstTeamPlayersFromRosters, player)
                            )
                        }
                        onMovePlayerForward={(player) =>
                            uiState.setPendingNewGameFirstTeamPlayers(
                                PlayerUtils.movePlayerForward(firstTeamPlayersFromRosters, player)
                            )
                        }
                        onMovePlayerToIndex={(player, index) =>
                            uiState.setPendingNewGameFirstTeamPlayers(
                                PlayerUtils.movePlayerToIndex(firstTeamPlayersFromRosters, player, index)
                            )
                        }
                        onTeamChange={teamChangeHandler}
                    />
                    <Separator vertical={true} />
                    <FromRostersTeamEntry
                        playerListHeight={playerListHeight}
                        playerPool={playersFromRosters}
                        players={secondTeamPlayersFromRosters}
                        teamNameErrorMessage={teamNameErrorMessage}
                        teamLabel="Second team"
                        onMovePlayerBackward={(player) =>
                            uiState.setPendingNewGameSecondTeamPlayers(
                                PlayerUtils.movePlayerBackward(secondTeamPlayersFromRosters, player)
                            )
                        }
                        onMovePlayerForward={(player) =>
                            uiState.setPendingNewGameSecondTeamPlayers(
                                PlayerUtils.movePlayerForward(secondTeamPlayersFromRosters, player)
                            )
                        }
                        onMovePlayerToIndex={(player, index) =>
                            uiState.setPendingNewGameSecondTeamPlayers(
                                PlayerUtils.movePlayerToIndex(secondTeamPlayersFromRosters, player, index)
                            )
                        }
                        onTeamChange={teamChangeHandler}
                    />
                </div>
            </StackItem>
        </Stack>
    );
});

const FromQBJRegistrationNewGameBody = observer(function FromQBJRegistrationNewGameBody(
    props: INewGamePivotItemProps
): JSX.Element {
    const uiState: UIState = props.appState.uiState;

    const loadHandler = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>, file: File) => {
            if (
                uiState.pendingNewGame == undefined ||
                uiState.pendingNewGame.type !== PendingGameType.QBJRegistration
            ) {
                return;
            }

            uiState.clearPendingNewGameRegistrationStatus();

            file.text()
                .then((value) => {
                    const playersResult: IResult<Player[]> = QBJ.parseRegistration(value);
                    if (playersResult.success) {
                        uiState.setPendingNewGameRosters(playersResult.value);
                    } else {
                        uiState.setPendingNewGameRegistrationErrorMessage(playersResult.message);
                    }
                })
                .catch((reason) => uiState.setPendingNewGameRegistrationErrorMessage(reason.toString()));
        },
        [uiState]
    );

    const teamChangeHandler = React.useCallback(
        (newTeamName: string, oldPlayers: Player[]): void => {
            if (
                uiState.pendingNewGame == undefined ||
                uiState.pendingNewGame.type !== PendingGameType.QBJRegistration
            ) {
                return;
            }

            // If rosters exist, then so do the players, so we can do strict equality to see which team needs to be updated
            if (oldPlayers === uiState.pendingNewGame.registration.firstTeamPlayers) {
                uiState.setPendingNewGameFirstTeamPlayers(
                    uiState.pendingNewGame.registration.players.filter((player) => player.teamName === newTeamName) ??
                        []
                );
            } else if (oldPlayers === uiState.pendingNewGame.registration.secondTeamPlayers) {
                uiState.setPendingNewGameSecondTeamPlayers(
                    uiState.pendingNewGame.registration.players.filter((player) => player.teamName === newTeamName) ??
                        []
                );
            }
        },
        [uiState]
    );

    const pendingNewGame: IPendingNewGame | undefined = uiState.pendingNewGame;
    if (pendingNewGame == undefined || pendingNewGame.type !== PendingGameType.QBJRegistration) {
        return <></>;
    }

    const firstTeamPlayers: Player[] = pendingNewGame.registration.firstTeamPlayers ?? [];
    const secondTeamPlayers: Player[] = pendingNewGame.registration.secondTeamPlayers ?? [];

    // We should only do this if we have any players from the rosters
    const teamNameErrorMessage = NewGameValidator.playerTeamsUnique(firstTeamPlayers, secondTeamPlayers);

    const playersFromRosters: Player[] = pendingNewGame.registration.players ?? [];
    const registrationErrorMessage: string | undefined = pendingNewGame.registration.errorMessage;

    return (
        <ThemeContext.Consumer>
            {(theme) => (
                <Stack>
                    <StackItem styles={rosterFileLinkStyles}>
                        <Link href="https://www.quizbowlreader.com/createTournamentFile.html" target="_blank">
                            Create registration file
                        </Link>
                    </StackItem>
                    <StackItem>
                        <div className={props.classes.loadContainer}>
                            <FilePicker buttonText="Load Roster..." onChange={loadHandler} />
                        </div>
                        <Label styles={{ root: { color: theme?.palette.red } }}>{registrationErrorMessage}</Label>
                    </StackItem>
                    <Separator />
                    <StackItem>
                        <div className={props.classes.teamEntriesContainer}>
                            <FromRostersTeamEntry
                                playerListHeight={playerListHeight}
                                playerPool={playersFromRosters}
                                players={firstTeamPlayers}
                                teamLabel="First team"
                                onMovePlayerBackward={(player) =>
                                    uiState.setPendingNewGameFirstTeamPlayers(
                                        PlayerUtils.movePlayerBackward(firstTeamPlayers, player)
                                    )
                                }
                                onMovePlayerForward={(player) =>
                                    uiState.setPendingNewGameFirstTeamPlayers(
                                        PlayerUtils.movePlayerForward(firstTeamPlayers, player)
                                    )
                                }
                                onMovePlayerToIndex={(player, index) =>
                                    uiState.setPendingNewGameFirstTeamPlayers(
                                        PlayerUtils.movePlayerToIndex(firstTeamPlayers, player, index)
                                    )
                                }
                                onTeamChange={teamChangeHandler}
                            />
                            <Separator vertical={true} />
                            <FromRostersTeamEntry
                                playerListHeight={playerListHeight}
                                playerPool={playersFromRosters}
                                players={secondTeamPlayers}
                                teamNameErrorMessage={teamNameErrorMessage}
                                teamLabel="Second team"
                                onMovePlayerBackward={(player) =>
                                    uiState.setPendingNewGameSecondTeamPlayers(
                                        PlayerUtils.movePlayerBackward(secondTeamPlayers, player)
                                    )
                                }
                                onMovePlayerForward={(player) =>
                                    uiState.setPendingNewGameSecondTeamPlayers(
                                        PlayerUtils.movePlayerForward(secondTeamPlayers, player)
                                    )
                                }
                                onMovePlayerToIndex={(player, index) =>
                                    uiState.setPendingNewGameSecondTeamPlayers(
                                        PlayerUtils.movePlayerToIndex(secondTeamPlayers, player, index)
                                    )
                                }
                                onTeamChange={teamChangeHandler}
                            />
                        </div>
                    </StackItem>
                </Stack>
            )}
        </ThemeContext.Consumer>
    );
});

function getDefaultPivotKey(pendingGameType: PendingGameType | undefined): PivotKey {
    switch (pendingGameType) {
        case PendingGameType.Manual:
        case undefined:
            return PivotKey.Manual;
        case PendingGameType.TJSheets:
            return PivotKey.TJSheets;
        case PendingGameType.UCSDSheets:
            return PivotKey.UCSDSheets;
        case PendingGameType.QBJRegistration:
            return PivotKey.QBJRegistration;
        default:
            assertNever(pendingGameType);
    }
}

function onAddPlayer(appState: AppState, players: Player[]): void {
    const uiState: UIState = appState.uiState;

    if (uiState.pendingNewGame?.type === PendingGameType.Manual) {
        // TODO: Use the format to determine if they are a starter
        const teamName: string = players[0].teamName;
        const newPlayer: Player = new Player("", teamName, players.length < 4);

        if (players === uiState.pendingNewGame.manual.firstTeamPlayers) {
            uiState.addPlayerToFirstTeamInPendingNewGame(newPlayer);
        } else {
            uiState.addPlayerToSecondTeamInPendingNewGame(newPlayer);
        }
    }
}

function onRemovePlayer(appState: AppState, player: Player): void {
    const uiState: UIState = appState.uiState;

    if (uiState.pendingNewGame?.type === PendingGameType.Manual) {
        if (player.teamName === uiState.pendingNewGame.manual.firstTeamPlayers[0].teamName) {
            uiState.removePlayerToFirstTeamInPendingNewGame(player);
        } else {
            uiState.removePlayerToSecondTeamInPendingNewGame(player);
        }
    }
}

// We need this to recreate the game, so we may need to add more methods to it
function onSubmit(appState: AppState): void {
    const uiState: UIState = appState.uiState;

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
    const game: GameState = appState.game;
    game.clear();
    game.addNewPlayers(firstTeamPlayers.filter((player) => player.name !== ""));
    game.addNewPlayers(secondTeamPlayers.filter((player) => player.name !== ""));
    game.loadPacket(pendingNewGame.packet);

    game.setGameFormat(pendingNewGame.gameFormat);

    // If we've just started a new game, start at the beginning
    uiState.setCycleIndex(0);

    // If we're manually entering names, clear the sheetsId field, since we don't have a scoresheet for this game
    if (pendingNewGame.type === PendingGameType.Manual) {
        uiState.resetSheetsId();
    }

    // Increase the round number by 1 if the round number exists, since the person is probably reading the next game
    if (uiState.sheetsState.roundNumber != undefined) {
        uiState.sheetsState.setRoundNumber(uiState.sheetsState.roundNumber + 1);
    }

    if (uiState.exportRoundNumber != undefined) {
        uiState.setExportRoundNumber(uiState.exportRoundNumber + 1);
    }

    hideDialog(appState);
}

function onCancel(appState: AppState): void {
    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideModalDialog();
    appState.uiState.resetPendingNewGame();
}
interface INewGamePivotItemProps {
    appState: AppState;
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
            minHeight: "25vh",
        },
        teamNameInput: {
            marginBottom: "10px",
        },
    });
