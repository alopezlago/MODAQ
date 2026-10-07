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

import * as ErrataExport from "../../state/ErrataExport";
import * as QBJ from "../../qbj/QBJ";
import { AppState } from "../../state/AppState";
import { IErrataExport } from "../../state/ErrataExport";
import { GameState } from "../../state/GameState";
import { useAppState } from "../../contexts/StateContext";
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
    const appState: AppState = useAppState();

    const cancelHandler = (): void => hideDialog(appState);

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
            {!appState.uiState.hostSettings.onlyAllowQbjExport && (
                <>
                    <Label>To export the whole game (packet, players, and events), click on &quot;Export game&quot;.</Label>
                    <Label>To only export the events, click on &quot;Export events&quot;.</Label>
                </>
            )}
            <RoundSelector
                roundNumber={roundNumber}
                onRoundNumberChange={(newValue) => appState.uiState.setExportRoundNumber(newValue)}
            />
            <ExportToJsonDialogFooter appState={appState} roundNumber={roundNumber} />
        </Dialog>
    );
});

const ExportToJsonDialogFooter = observer(function ExportToJsonDialogFooter(
    props: IExportToJsonDialogFooterProps
): JSX.Element {
    const appState: AppState = props.appState;
    const game: GameState = appState.game;
    const roundNumber: number | undefined = props.roundNumber;

    const cancelHandler = (): void => hideDialog(appState);

    // Errata get their own file so the exports stay exactly what stats programs (e.g. YellowFruit) expect, but the
    // moderator shouldn't have to remember a second button for them
    const errataExport: IErrataExport | undefined = ErrataExport.createErrataExport(appState, roundNumber);
    const errataCount: number = errataExport?.errata.length ?? 0;

    const exportHandler = (): void => {
        if (errataExport != undefined) {
            downloadJson(JSON.stringify(errataExport, null, 2), ErrataExport.getErrataFilename(appState, roundNumber));
        }

        exportGame(appState);
    };

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

    const buttons: JSX.Element[] = [];
    if (!appState.uiState.hostSettings.onlyAllowQbjExport) {
        buttons.push(
            <PrimaryButton
                key="exportGame"
                className="export-json-game"
                text="Export game"
                onClick={exportHandler}
                href={gameHref}
                download={gameFilename}
            />,
            <PrimaryButton
                key="exportEvents"
                className="export-json-events"
                text="Export events"
                onClick={exportHandler}
                href={cyclesHref}
                download={cyclesFilename}
            />
        );
    }
    buttons.push(
        <PrimaryButton
            key="exportQBJ"
            className="export-json-qbj"
            text="Export QBJ"
            onClick={exportHandler}
            href={qbjHref}
            download={qbjFilename}
        />,
        <DefaultButton key="cancel" text="Cancel" onClick={cancelHandler} />
    );

    return (
        <>
            {errataCount > 0 && (
                <Label>
                    The {errataCount} errata you noted on questions will be downloaded alongside the export, in a file
                    of their own, so they don&apos;t interfere with importing the game elsewhere.
                </Label>
            )}
            <DialogFooter>{buttons}</DialogFooter>
        </>
    );
});

// The export buttons are links to the file they download, so the errata file needs a temporary link of its own to
// come down on the same click.
function downloadJson(contents: string, filename: string): void {
    const url: string = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const link: HTMLAnchorElement = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportGame(appState: AppState): void {
    appState.game.markUpdateComplete();
    hideDialog(appState);
}

function hideDialog(appState: AppState) {
    appState.uiState.dialogState.hideModalDialog();
}

interface IExportToJsonDialogFooterProps {
    appState: AppState;
    roundNumber: number | undefined;
}
