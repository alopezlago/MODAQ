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
} from "@fluentui/react";

import * as QBJ from "../../qbj/QBJ";
import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { StateContext } from "../../contexts/StateContext";
import { RoundSelector } from "../RoundSelector";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Export to JSON",
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
            // To have max width respected normally, we'd need to pass in an IDialogStyleProps, but it ridiculously
            // requires you to pass in an entire theme to modify the max width. We could also use a modal, but that
            // requires building much of what Dialogs offer easily (close buttons, footer for buttons)
            minWidth: "30vw !important",
        },
    },
    topOffsetFixed: true,
};

export const ExportToJsonDialog = observer(function ExportToJsonDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const cancelHandler = React.useCallback(() => hideDialog(appState), [appState]);

    // Skip computing all the blobs if the dialog isn't visible
    if (appState.uiState.dialogState.visibleDialog !== ModalVisibilityStatus.ExportToJson) {
        return <></>;
    }

    const roundNumber: number | undefined =
        appState.uiState.exportRoundNumber ?? appState.uiState.sheetsState.roundNumber ?? 1;

    return (
        <Dialog
            hidden={appState.uiState.dialogState.visibleDialog !== ModalVisibilityStatus.ExportToJson}
            dialogContentProps={content}
            modalProps={modalProps}
            maxWidth="40vw"
            onDismiss={cancelHandler}
        >
            <Label>To export the whole game (packet, players, and events), click on &quot;Export game&quot;.</Label>
            <Label>To only export the events, click on &quot;Export events&quot;.</Label>
            <RoundSelector
                roundNumber={roundNumber}
                onRoundNumberChange={(newValue) => appState.uiState.setExportRoundNumber(newValue)}
            />
            <ExportToJsonDialogFooter roundNumber={roundNumber} />
        </Dialog>
    );
});

const ExportToJsonDialogFooter = observer(function ExportToJsonDialogFooter(
    props: IExportToJsonDialogFooterProps
): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const game: GameState = appState.game;
    const roundNumber: number | undefined = props.roundNumber;

    const cancelHandler = React.useCallback(() => hideDialog(appState), [appState]);
    const exportHandler = React.useCallback(() => exportGame(appState), [appState]);

    const joinedTeamNames: string = game.teamNames.join("_");

    const cyclesJson: Blob = new Blob([JSON.stringify(game.cycles, null, 2)], { type: "application/json" });
    const cyclesHref: string = URL.createObjectURL(cyclesJson);
    const cyclesFilename = `Round_${roundNumber}_${joinedTeamNames}_Events.json`;

    const gameJson: Blob = new Blob([JSON.stringify(game, null, 2)], { type: "application/json" });
    const gameHref: string = URL.createObjectURL(gameJson);
    const gameFilename = `Round_${roundNumber}_${joinedTeamNames}_Game.json`;

    const qbjJson: Blob = new Blob(
        [QBJ.toQBJString(game, game.packet.name ?? appState.uiState.packetFilename, roundNumber)],
        {
            type: "application/json",
        }
    );
    const qbjHref: string = URL.createObjectURL(qbjJson);
    const qbjFilename = `Round_${roundNumber}_${joinedTeamNames}.qbj`;

    return (
        <DialogFooter>
            <PrimaryButton text="Export game" onClick={exportHandler} href={gameHref} download={gameFilename} />
            <PrimaryButton text="Export events" onClick={exportHandler} href={cyclesHref} download={cyclesFilename} />
            <PrimaryButton text="Export QBJ" onClick={exportHandler} href={qbjHref} download={qbjFilename} />
            <DefaultButton text="Cancel" onClick={cancelHandler} />
        </DialogFooter>
    );
});

function exportGame(appState: AppState): void {
    appState.game.markUpdateComplete();
    hideDialog(appState);
}

function hideDialog(appState: AppState) {
    appState.uiState.dialogState.hideModalDialog();
}

interface IExportToJsonDialogFooterProps {
    roundNumber: number | undefined;
}
