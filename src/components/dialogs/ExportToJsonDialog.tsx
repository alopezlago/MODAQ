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
            top: "25vh",
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
    const game: GameState = appState.game;

    const closeHandler = React.useCallback(() => hideDialog(appState), [appState]);

    const joinedTeamNames: string = game.teamNames.join("_");

    const cyclesJson: Blob = new Blob([JSON.stringify(game.cycles)], { type: "application/json" });
    const cyclesHref: string = URL.createObjectURL(cyclesJson);
    const cyclesFilename = `${joinedTeamNames}_Events.json`;

    const gameJson: Blob = new Blob([JSON.stringify(game)], { type: "application/json" });
    const gameHref: string = URL.createObjectURL(gameJson);
    const gameFilename = `${joinedTeamNames}_Game.json`;

    const qbjJson: Blob = new Blob([QBJ.toQBJString(game, appState.uiState.packetFilename)], {
        type: "application/json",
    });
    const qbjHref: string = URL.createObjectURL(qbjJson);
    const qbjFilename = `${joinedTeamNames}.qbj`;

    return (
        <Dialog
            hidden={!appState.uiState.dialogState.exportToJsonDialogVisible}
            dialogContentProps={content}
            modalProps={modalProps}
            maxWidth="40vw"
            onDismiss={closeHandler}
        >
            <Label>To export the whole game (packet, players, and events), click on &quot;Export game&quot;.</Label>
            <Label>To only export the events, click on &quot;Export events&quot;.</Label>
            <DialogFooter>
                <PrimaryButton text="Export game" onClick={closeHandler} href={gameHref} download={gameFilename} />
                <PrimaryButton
                    text="Export events"
                    onClick={closeHandler}
                    href={cyclesHref}
                    download={cyclesFilename}
                />
                <PrimaryButton text="Export QBJ" onClick={closeHandler} href={qbjHref} download={qbjFilename} />
                <DefaultButton text="Cancel" onClick={closeHandler} />
            </DialogFooter>
        </Dialog>
    );
});

function hideDialog(appState: AppState) {
    appState.uiState.dialogState.hideExportToJsonDialog();
}
