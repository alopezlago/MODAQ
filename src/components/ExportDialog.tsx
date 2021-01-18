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
import { SheetState } from "src/state/SheetState";

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
        const exportHandler = React.useCallback(() => onExport(props), [props]);

        return (
            <Dialog
                hidden={props.uiState.pendingSheet == undefined || props.uiState.sheetsState?.exportState != undefined}
                dialogContentProps={content}
                modalProps={modalProps}
                onDismiss={cancelHandler}
            >
                <ExportSettingsDialogBody {...props} />
                <DialogFooter>
                    <DefaultButton text="Cancel" onClick={cancelHandler} />
                    <PrimaryButton text="Export" onClick={exportHandler} />
                </DialogFooter>
            </Dialog>
        );
    }
);

export const ExportStatusDialog = observer(
    (props: IExportDialogProps): JSX.Element => {
        const cancelHandler = React.useCallback(() => onClose(props), [props]);

        return (
            <Dialog
                hidden={props.uiState.sheetsState?.exportState == undefined}
                dialogContentProps={content}
                modalProps={modalProps}
                onDismiss={cancelHandler}
            >
                <ExportStatusBody {...props} />
                <DialogFooter>
                    <PrimaryButton text="Close" onClick={cancelHandler} />
                </DialogFooter>
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

function onExport(props: IExportDialogProps): void {
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

    // props.uiState.resetPendingSheet(); // Can't do this because pending is what determines if this is here

    Sheets.exportToSheet(props.game, props.uiState);
    return;
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
