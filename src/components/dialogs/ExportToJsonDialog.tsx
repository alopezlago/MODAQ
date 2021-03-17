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
import { AppState } from "src/state/AppState";
import { GameState } from "src/state/GameState";

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
        },
    },
    topOffsetFixed: true,
};

export const ExportToJsonDialog = observer(
    (props: IExportToJsonDialogProps): JSX.Element => {
        const game: GameState = props.appState.game;

        const closeHandler = React.useCallback(() => hideDialog(props), [props]);

        const joinedTeamNames: string = game.teamNames.join("_");

        const cyclesJson: Blob = new Blob([JSON.stringify(game.cycles)], { type: "application/json" });
        const cyclesHref: string = URL.createObjectURL(cyclesJson);
        const cyclesFilename = `${joinedTeamNames}_Events.json`;

        const gameJson: Blob = new Blob([JSON.stringify(game)], { type: "application/json" });
        const gameHref: string = URL.createObjectURL(gameJson);
        const gameFilename = `${joinedTeamNames}_Game.json`;

        return (
            <Dialog
                hidden={!props.appState.uiState.dialogState.exportToJsonDialogVisible}
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
                    <DefaultButton text="Cancel" onClick={closeHandler} />
                </DialogFooter>
            </Dialog>
        );
    }
);

function hideDialog(props: IExportToJsonDialogProps) {
    props.appState.uiState.dialogState.hideExportToJsonDialog();
}

export interface IExportToJsonDialogProps {
    appState: AppState;
}
