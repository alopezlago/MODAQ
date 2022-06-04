import React from "react";
import { observer } from "mobx-react-lite";
import {
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    Label,
    ContextualMenu,
    DialogType,
    IDialogContentProps,
    IModalProps,
    Stack,
    ILabelStyles,
    StackItem,
    IStackTokens,
} from "@fluentui/react";

import * as NewGameValidator from "../../state/NewGameValidator";
import * as PendingNewGameUtils from "../../state/PendingNewGameUtils";
import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { FilePicker } from "../FilePicker";
import { UIState } from "../../state/UIState";
import { IPlayer, Player } from "../../state/TeamState";
import { Bonus, PacketState, Tossup } from "../../state/PacketState";
import { Cycle, ICycle } from "../../state/Cycle";
import { IPendingNewGame, PendingGameType } from "../../state/IPendingNewGame";
import { StateContext } from "../../contexts/StateContext";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Import Game",
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

const stackTokens: IStackTokens = { childrenGap: 10 };

export const ImportGameDialog = observer(function ImportGameDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const cancelHandler = React.useCallback(() => hideDialog(appState), [appState]);
    const submitHandler = React.useCallback(() => onSubmit(appState), [appState]);

    return (
        <Dialog
            hidden={!appState.uiState.dialogState.importGameDialogVisible}
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={cancelHandler}
        >
            <ImportGameDialogBody />
            <DialogFooter>
                <PrimaryButton text="Import Game" onClick={submitHandler} />
                <DefaultButton text="Cancel" onClick={cancelHandler} />
            </DialogFooter>
        </Dialog>
    );
});

const ImportGameDialogBody = observer(function ImportGameDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const loadHandler = React.useCallback(
        (ev: ProgressEvent<FileReader>): void => {
            onLoad(ev, appState);
        },
        [appState]
    );
    const changeHandler = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>, fileList: FileList | null | undefined) =>
            onFilePickerChange(appState, fileList, loadHandler),
        [appState, loadHandler]
    );

    const statusStyles: ILabelStyles = {
        root: {
            color: appState.uiState.importGameStatus?.isError ?? false ? "rgb(128, 0, 0)" : undefined,
        },
    };

    return (
        <Stack tokens={stackTokens}>
            <StackItem>
                <FilePicker
                    accept="application/json"
                    buttonText="Load..."
                    label="Game file (JSON)"
                    required={true}
                    onChange={changeHandler}
                />
            </StackItem>
            <StackItem>
                <Label styles={statusStyles}>{appState.uiState.importGameStatus?.status}</Label>
            </StackItem>
        </Stack>
    );
});

function onFilePickerChange(
    appState: AppState,
    fileList: FileList | null | undefined,
    onLoadHandler: (ev: ProgressEvent<FileReader>) => void
): void {
    if (fileList == undefined) {
        return;
    }

    const file: File = fileList[0];

    const fileReader = new FileReader();
    fileReader.onload = onLoadHandler;

    if (file.type !== "application/json" && file.type !== "text/plain") {
        setInvalidGameStatus(appState.uiState, "Unexpected file format. The file format must be JSON.");
        return;
    }

    fileReader.readAsText(file);
}

function onLoad(event: ProgressEvent<FileReader>, appState: AppState): void {
    if (event.target == undefined || event.target.result == undefined || typeof event.target.result !== "string") {
        return;
    }

    const uiState: UIState = appState.uiState;

    const parsedGame: IGame = JSON.parse(event.target.result);
    if (parsedGame.cycles == undefined) {
        setInvalidGameStatus(uiState, 'No events in the given game. There must be an array of "cycles".');
        return;
    } else if (parsedGame.packet == undefined) {
        setInvalidGameStatus(uiState, 'No packet in the given game. There must be a "packet" object.');
        return;
    } else if (parsedGame.players == undefined) {
        setInvalidGameStatus(uiState, 'No players in the given game. There must be an array of "players".');
        return;
    } else if (parsedGame.cycles.length === 0) {
        setInvalidGameStatus(uiState, "Game has an empty set of events, meaning that there are zero questions.");
        return;
    }

    uiState.createPendingNewGame();

    const playersMap: Map<string, Player[]> = new Map<string, Player[]>();
    for (const serializedPlayer of parsedGame.players) {
        if (serializedPlayer.name == undefined || serializedPlayer.name.trim() === "") {
            setInvalidGameStatus(uiState, "Player with undefined name found.");
            return;
        } else if (serializedPlayer.teamName == undefined) {
            setInvalidGameStatus(uiState, `Player with undefined team name found. Player: ${serializedPlayer.name}`);
            return;
        }

        const player: Player = new Player(serializedPlayer.name, serializedPlayer.teamName, serializedPlayer.isStarter);
        if (!playersMap.has(player.teamName)) {
            playersMap.set(player.teamName, []);
            if (playersMap.size > 2) {
                setInvalidGameStatus(uiState, "This game has more than 2 teams.");
                return;
            }
        }

        const teamPlayers: Player[] | undefined = playersMap.get(player.teamName);
        teamPlayers?.push(player);
    }

    if (playersMap.size !== 2) {
        setInvalidGameStatus(uiState, `Games should have 2 teams, but this one has ${playersMap.size}.`);
        return;
    }

    const allPlayers: Player[][] = [...playersMap.values()];

    if (allPlayers[0].length === 0) {
        setInvalidGameStatus(uiState, "First team doesn't have any players.");
        return;
    } else if (allPlayers[1].length === 0) {
        setInvalidGameStatus(uiState, "Second team doesn't have any players.");
        return;
    }

    uiState.setPendingNewGameFirstTeamPlayers(allPlayers[0]);
    uiState.setPendingNewGameSecondTeamPlayers(allPlayers[1]);

    // Need to set up packet and cycles... but we can't set the packet until later, when we load it in the game...?
    // set it directly
    if (
        parsedGame.packet.tossups == undefined ||
        parsedGame.packet.tossups.length == undefined ||
        parsedGame.packet.tossups.length === 0
    ) {
        setInvalidGameStatus(uiState, "No tossups in the packet.");
        return;
    }

    const packet: PacketState = new PacketState();
    const tossups: Tossup[] = parsedGame.packet.tossups.map(
        (tossup) => new Tossup(tossup.question, tossup.answer, tossup.metadata)
    );
    packet.setTossups(tossups);

    if (parsedGame.packet.bonuses != undefined && parsedGame.packet.bonuses.length > 0) {
        const bonuses: Bonus[] = parsedGame.packet.bonuses.map(
            (bonus) => new Bonus(bonus.leadin, bonus.parts, bonus.metadata)
        );
        packet.setBonuses(bonuses);
    }

    if (uiState.pendingNewGame == undefined) {
        uiState.setImportGameStatus({
            isError: true,
            status: "Unexpected error. Couldn't find imported game. Try loading the game file again.",
        });
        return;
    }

    uiState.pendingNewGame.packet = packet;

    const cycles: Cycle[] = parsedGame.cycles.map((deserializedCycle) => new Cycle(deserializedCycle));
    uiState.setPendingNewGameCycles(cycles);

    // Format: "Valid game. X tossup(s), X bonus(es). Team1 vs Team2."
    uiState.setImportGameStatus({
        isError: false,
        status: `Valid game. ${packet.tossups.length} tossup(s), ${packet.bonuses.length} bonus(es). Game between "${allPlayers[0][0].teamName}" and "${allPlayers[1][0].teamName}".`,
    });
}

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideImportGameDialog();
    appState.uiState.resetPendingNewGame();
}

function onSubmit(appState: AppState): void {
    const game: GameState = appState.game;
    const uiState: UIState = appState.uiState;

    if (uiState.pendingNewGame == undefined) {
        return;
    }

    const pendingNewGame: IPendingNewGame = uiState.pendingNewGame;
    if (pendingNewGame.type !== PendingGameType.Manual) {
        return;
    }

    if (!NewGameValidator.isValid(pendingNewGame)) {
        setInvalidGameStatus(uiState, "Further validation failed.");
        return;
    }

    const [firstTeamPlayers, secondTeamPlayers]: Player[][] = PendingNewGameUtils.getPendingNewGamePlayers(
        pendingNewGame
    );

    // Trim all the player names now
    for (const player of firstTeamPlayers.concat(secondTeamPlayers)) {
        player.setName(player.name.trim());
    }

    // We need to set the game's packet, players, etc. to the values in the uiState
    game.clear();
    game.addPlayers(firstTeamPlayers.filter((player) => player.name !== ""));
    game.addPlayers(secondTeamPlayers.filter((player) => player.name !== ""));
    game.loadPacket(pendingNewGame.packet);
    game.setCycles(pendingNewGame.cycles ?? []);

    // If we've just started a new game, start at the beginning
    uiState.setCycleIndex(0);

    hideDialog(appState);
}

function setInvalidGameStatus(uiState: UIState, message: string): void {
    uiState.setImportGameStatus({ isError: true, status: `Invalid game. ${message}` });
}

interface IGame {
    cycles: ICycle[];
    players: IPlayer[];
    packet: PacketState;
}
