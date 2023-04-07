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

import * as NewGameValidator from "../../state/NewGameValidator";
import * as PendingNewGameUtils from "../../state/PendingNewGameUtils";
import * as QBJ from "../../qbj/QBJ";
import * as Sheets from "../../sheets/Sheets";
import { UIState } from "../../state/UIState";
import { PacketLoader } from "../PacketLoader";
import { GameState } from "../../state/GameState";
import { PacketState } from "../../state/PacketState";
import { ManualTeamEntry } from "../ManualTeamEntry";
import { Player } from "../../state/TeamState";
import { IPendingNewGame, PendingGameType } from "../../state/IPendingNewGame";
import { AppState } from "../../state/AppState";
import { FromRostersTeamEntry } from "../FromRostersTeamEntry";
import { SheetType } from "../../state/SheetState";
import { GameFormatPicker } from "../GameFormatPicker";
import { StateContext } from "../../contexts/StateContext";
import { IGameFormat } from "../../state/IGameFormat";
import { FilePicker } from "../FilePicker";

const playerListHeight = "20vh";

const enum PivotKey {
    Manual = "M",
    Lifsheets = "L",
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
            maxWidth: "80% !important",
            top: "5vh",
        },
    },
};

const rostersInputStyles: Partial<ITextFieldStyles> = { root: { marginRight: 10, width: "75%" } };

export const NewGameDialog = observer(function NewGameDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const submitHandler = React.useCallback(() => onSubmit(appState), [appState]);
    const cancelHandler = React.useCallback(() => onCancel(appState), [appState]);

    return (
        <Dialog
            hidden={!appState.uiState.dialogState.newGameDialogVisible}
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={cancelHandler}
        >
            {appState.uiState.dialogState.newGameDialogVisible && <NewGameDialogBody />}
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
                case PivotKey.Lifsheets:
                    newGameType = PendingGameType.Lifsheets;
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
                <PivotItem headerText="From Lifsheets" itemKey={PivotKey.Lifsheets}>
                    <FromSheetsNewGameBody appState={appState} classes={classes} />
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
            <PacketLoader appState={appState} onLoad={packetLoadHandler} />
            <Separator />
            <GameFormatPicker
                gameFormat={uiState.pendingNewGame.gameFormat}
                exportFormatSupportsBouncebacks={
                    uiState.pendingNewGame.type !== PendingGameType.Lifsheets &&
                    uiState.pendingNewGame.type !== PendingGameType.UCSDSheets
                }
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
            if (
                uiState.pendingNewGame == undefined ||
                uiState.pendingNewGame.type === PendingGameType.Manual ||
                uiState.pendingNewGame.type === PendingGameType.QBJRegistration
            ) {
                return;
            }

            // If rosters exist, then so do the players, so we can do strict equality to see which team needs to be updated
            if (oldPlayers === uiState.pendingNewGame?.firstTeamPlayersFromRosters) {
                uiState.setPendingNewGameFirstTeamPlayers(
                    uiState.pendingNewGame.playersFromRosters?.filter((player) => player.teamName === newTeamName) ?? []
                );
            } else if (oldPlayers === uiState.pendingNewGame?.secondTeamPlayersFromRosters) {
                uiState.setPendingNewGameSecondTeamPlayers(
                    uiState.pendingNewGame.playersFromRosters?.filter((player) => player.teamName === newTeamName) ?? []
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
});

const FromQBJRegistrationNewGameBody = observer(function FromSheetsNewGameBody(
    props: INewGamePivotItemProps
): JSX.Element {
    const uiState: UIState = props.appState.uiState;

    const loadHandler = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>, fileList: FileList | null | undefined) => {
            if (
                fileList == undefined ||
                uiState.pendingNewGame == undefined ||
                uiState.pendingNewGame.type !== PendingGameType.QBJRegistration
            ) {
                return;
            }

            const file: File | null = fileList.item(0);
            if (file === null) {
                return;
            }

            file.text().then((value) => {
                const players: Player[] = QBJ.parseRegistration(value);
                uiState.setPendingNewGameRosters(players);
            });
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
            if (oldPlayers === uiState.pendingNewGame.firstTeamPlayers) {
                uiState.setPendingNewGameFirstTeamPlayers(
                    uiState.pendingNewGame.players.filter((player) => player.teamName === newTeamName) ?? []
                );
            } else if (oldPlayers === uiState.pendingNewGame.secondTeamPlayers) {
                uiState.setPendingNewGameSecondTeamPlayers(
                    uiState.pendingNewGame.players.filter((player) => player.teamName === newTeamName) ?? []
                );
            }
        },
        [uiState]
    );

    const pendingNewGame: IPendingNewGame | undefined = uiState.pendingNewGame;
    if (pendingNewGame == undefined || pendingNewGame.type !== PendingGameType.QBJRegistration) {
        return <></>;
    }

    const firstTeamPlayers: Player[] = pendingNewGame.firstTeamPlayers ?? [];
    const secondTeamPlayers: Player[] = pendingNewGame.secondTeamPlayers ?? [];

    // We should only do this if we have any players from the rosters
    const teamNameErrorMessage = NewGameValidator.playerTeamsUnique(firstTeamPlayers, secondTeamPlayers);

    const playersFromRosters: Player[] = pendingNewGame.players ?? [];

    return (
        <Stack>
            <StackItem>
                <div className={props.classes.loadContainer}>
                    <FilePicker buttonText="Load Roster..." onChange={loadHandler} />
                </div>
            </StackItem>
            <Separator />
            <StackItem>
                <div className={props.classes.teamEntriesContainer}>
                    <FromRostersTeamEntry
                        playerListHeight={playerListHeight}
                        playerPool={playersFromRosters}
                        players={firstTeamPlayers}
                        teamLabel="First team"
                        onTeamChange={teamChangeHandler}
                    />
                    <Separator vertical={true} />
                    <FromRostersTeamEntry
                        playerListHeight={playerListHeight}
                        playerPool={playersFromRosters}
                        players={secondTeamPlayers}
                        teamNameErrorMessage={teamNameErrorMessage}
                        teamLabel="Second team"
                        onTeamChange={teamChangeHandler}
                    />
                </div>
            </StackItem>
        </Stack>
    );
});

function getDefaultPivotKey(pendingGameType: PendingGameType | undefined): PivotKey {
    switch (pendingGameType) {
        case PendingGameType.Manual:
        case undefined:
            return PivotKey.Manual;
        case PendingGameType.Lifsheets:
            return PivotKey.Lifsheets;
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

        if (players === uiState.pendingNewGame.firstTeamPlayers) {
            uiState.addPlayerToFirstTeamInPendingNewGame(newPlayer);
        } else {
            uiState.addPlayerToSecondTeamInPendingNewGame(newPlayer);
        }
    }
}

function onRemovePlayer(appState: AppState, player: Player): void {
    const uiState: UIState = appState.uiState;

    if (uiState.pendingNewGame?.type === PendingGameType.Manual) {
        if (player.teamName === uiState.pendingNewGame.firstTeamPlayers[0].teamName) {
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
    game.addPlayers(firstTeamPlayers.filter((player) => player.name !== ""));
    game.addPlayers(secondTeamPlayers.filter((player) => player.name !== ""));
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
    appState.uiState.dialogState.hideNewGameDialog();
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
            width: "50vw",
        },
        teamNameInput: {
            marginBottom: "10px",
        },
    });
