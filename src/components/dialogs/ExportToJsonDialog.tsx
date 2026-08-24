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
            <Label>To export the game, click on &quot;Export QBJ&quot;.</Label>
            <Label>
                Any errata you noted on questions come down alongside it, in a file of their own, so they don&apos;t
                interfere with importing the game elsewhere.
            </Label>
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

    const joinedTeamNames: string = game.teamNames.join("_");

    const qbjFilename = `Round_${roundNumber}_${joinedTeamNames}.qbj`;

    // Errata get their own file so the QBJ stays exactly what stats programs (e.g. YellowFruit) expect, but the
    // moderator shouldn't have to remember a second button for them
    const errataExport: IErrataExport | undefined = ErrataExport.createErrataExport(appState, roundNumber);
    const errataCount: number = errataExport?.errata.length ?? 0;

    const exportHandler = (): void => {
        downloadJson(
            QBJ.toQBJString(game, game.packet.name ?? appState.uiState.packetFilename, roundNumber),
            qbjFilename
        );

        if (errataExport != undefined) {
            downloadJson(
                JSON.stringify(errataExport, null, 2),
                ErrataExport.getErrataFilename(appState, roundNumber)
            );
        }

        appState.game.markUpdateComplete();
        hideDialog(appState);
    };

    return (
        <DialogFooter>
            <PrimaryButton
                text={errataCount > 0 ? `Export QBJ (+ ${errataCount} errata)` : "Export QBJ"}
                title={
                    errataCount > 0
                        ? "Download the QBJ and, as a separate file, the errata noted on questions"
                        : "Download the QBJ"
                }
                onClick={exportHandler}
            />
            <DefaultButton text="Cancel" onClick={cancelHandler} />
        </DialogFooter>
    );
});

// Downloading through a temporary link (instead of an href on the button) lets one click bring down both the QBJ
// and the errata file.
function downloadJson(contents: string, filename: string): void {
    const url: string = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const link: HTMLAnchorElement = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoking immediately can cancel the download in some browsers, so give it a moment
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function hideDialog(appState: AppState) {
    appState.uiState.dialogState.hideModalDialog();
}

interface IExportToJsonDialogFooterProps {
    appState: AppState;
    roundNumber: number | undefined;
}
