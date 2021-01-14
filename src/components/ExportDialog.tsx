import * as React from "react";
import { observer } from "mobx-react";
import {
    TextField,
    IDialogContentProps,
    DialogType,
    IModalProps,
    ContextualMenu,
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    Label,
} from "@fluentui/react";

import * as Sheets from "src/sheets/Sheets";
import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";
import { IPendingSheet } from "src/state/IPendingSheet";
import { ExportState, SheetState } from "src/state/SheetState";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Export to Sheets",
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
};

// Have an Export/Cancel
// When Export is clicked, move to a status dialog

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const ExportDialog = observer(
    (props: IExportDialogProps): JSX.Element => {
        const cancelHandler = React.useCallback(() => onClose(props), [props]);

        // Can't use React.useCallback since it only appears in the first stage
        const exportHandler = async () => onExport(props);

        // The dialog footer should change: if an export hasn't started, it should be "Cancel"; if it's done, it
        // should be "close"
        // TODO: We should change the buttons based on the state
        // - Do we need to setup the export fields
        let body: JSX.Element | undefined = undefined;
        let footer: JSX.Element | undefined = undefined;
        if (props.uiState.sheetsState?.exportState == undefined) {
            footer = (
                <DialogFooter>
                    <DefaultButton text="Cancel" onClick={cancelHandler} />
                    <PrimaryButton text="Export" onClick={exportHandler} />
                </DialogFooter>
            );
            body = <ExportSettingsDialogBody {...props} />;
        } else {
            footer = (
                <DialogFooter>
                    <PrimaryButton text="Close" onClick={cancelHandler} />
                </DialogFooter>
            );
            body = <ExportStatusBody {...props} />;
        }

        return (
            <Dialog
                hidden={props.uiState.pendingSheet == undefined}
                dialogContentProps={content}
                modalProps={modalProps}
                onDismiss={cancelHandler}
            >
                {body}
                {footer}
            </Dialog>
        );
    }
);

const ExportSettingsDialogBody = observer(
    (props: IExportDialogProps): JSX.Element => {
        const sheetsUrlChangeHandler = React.useCallback(
            (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
                // URLs look like https://docs.google.com/spreadsheets/d/1ZWEIXEcDPpuYhMOqy7j8uKloKJ7xrMlx8Q8y4UCbjZA/edit#gid=17040017
                // The parsing should be done in a different method or place, so we can test it
                if (newValue == undefined) {
                    return;
                }

                newValue = newValue.trim();

                // TODO: This should be a const outside of the function when we move it
                const sheetsPrefix = "https://docs.google.com/spreadsheets/d/";
                if (newValue.startsWith(sheetsPrefix)) {
                    const nextSlash: number = newValue.indexOf("/", sheetsPrefix.length);
                    const sheetsId: string = newValue.substring(
                        sheetsPrefix.length,
                        nextSlash === -1 ? undefined : nextSlash
                    );

                    props.uiState.updatePendingSheetId(sheetsId.trim());
                }
            },
            [props]
        );

        const roundNumberChangeHandler = React.useCallback(
            (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
                if (newValue == undefined) {
                    return;
                }

                const roundNumber: number | undefined = parseInt(newValue, 10);
                if (isNaN(roundNumber)) {
                    // Don't accept the input if it's not a number
                    return;
                }

                props.uiState.updatePendingSheetRoundNumber(roundNumber);
            },
            [props]
        );

        // ISSUE: We're updating the state, so if they cancel, we still have these old values. This needs to belong
        // to a PendingSheetsState (minus initialized). Once we click submit, then update the actual SheetsState
        // This doesn't include the initialized flag, which should always be in the real one

        const sheet: IPendingSheet | undefined = props.uiState.pendingSheet;
        if (sheet === undefined) {
            return <></>;
        }

        const roundNumber: number = sheet.roundNumber ?? 1;

        // TODO: TextField needs to be wider
        return (
            <>
                <TextField label="SheetsUrl" required={true} onChange={sheetsUrlChangeHandler} />
                <TextField
                    label="RoundNumber"
                    value={roundNumber.toString()}
                    required={true}
                    onChange={roundNumberChangeHandler}
                />
            </>
        );
    }
);

const ExportStatusBody = observer(
    (props: IExportDialogProps): JSX.Element => {
        // ISSUE: We're updating the state, so if they cancel, we still have these old values. This needs to belong
        // to a PendingSheetsState (minus initialized). Once we click submit, then update the actual SheetsState
        // This doesn't include the initialized flag, which should always be in the real one

        const sheet: SheetState | undefined = props.uiState.sheetsState;
        if (sheet === undefined) {
            return <></>;
        }

        return (
            <>
                <Label>{sheet.exportStatus?.status}</Label>
            </>
        );
    }
);

async function onExport(props: IExportDialogProps): Promise<void> {
    // TODO: Set the exportStatusVisible flag to true
    // Set the SheetsState to the URL and round #
    // We should have PendingExportState, since we need the URL and the round #
    if (props.uiState.pendingSheet == undefined) {
        hideDialog(props);
        return;
    }

    if (
        props.uiState.pendingSheet.roundNumber == undefined ||
        props.uiState.pendingSheet.sheetId == undefined ||
        props.uiState.pendingSheet.sheetId.trim() === ""
    ) {
        // TODO: set validation
        return;
    }

    props.uiState.sheetsState.setRoundNumber(props.uiState.pendingSheet.roundNumber);
    props.uiState.sheetsState.setSheetId(props.uiState.pendingSheet.sheetId);
    props.uiState.sheetsState.setExportStatus(
        {
            isError: false,
            status: "Beginning export",
        },
        ExportState.Exporting
    );

    // TODO: Seems like we're stuck in the old dialog until this finishes... don't know why. May need to split out
    // dialogs, which is okay.
    return Sheets.exportToSheet(props.game, props.uiState);
}

function onClose(props: IExportDialogProps): void {
    hideDialog(props);
}

function hideDialog(props: IExportDialogProps): void {
    props.uiState.resetPendingSheet();
    props.uiState.sheetsState.clearExportStatus();
    props.uiState.sheetsState.clearRoundNumber();
}

export interface IExportDialogProps {
    game: GameState;
    uiState: UIState;
}
