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
    SpinButton,
    Stack,
    IStackTokens,
} from "@fluentui/react";

import * as Sheets from "src/sheets/Sheets";
import { UIState } from "src/state/UIState";
import { IPendingSheet } from "src/state/IPendingSheet";
import { SheetState } from "src/state/SheetState";
import { AppState } from "src/state/AppState";

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

const maximumRoundNumber = 30;
const sheetsPrefix = "https://docs.google.com/spreadsheets/d/";

const settingsStackTokens: Partial<IStackTokens> = { childrenGap: 10 };

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const ExportDialog = observer(
    (props: IExportDialogProps): JSX.Element => {
        const uiState: UIState = props.appState.uiState;
        const cancelHandler = React.useCallback(() => onClose(props), [props]);

        // Can't use React.useCallback since it only appears in the first stage
        const exportHandler = () => onExport(props);

        let body: JSX.Element | undefined;
        let footer: JSX.Element | undefined;
        if (uiState.sheetsState?.exportState == undefined) {
            body = <ExportSettingsDialogBody {...props} />;

            const exportDisabled: boolean = (uiState.pendingSheet?.sheetId ?? "") === "";
            footer = (
                <DialogFooter>
                    <DefaultButton text="Cancel" onClick={cancelHandler} autoFocus={false} />
                    <PrimaryButton text="Export" onClick={exportHandler} disabled={exportDisabled} autoFocus={false} />
                </DialogFooter>
            );
        } else {
            body = <ExportStatusBody {...props} />;
            footer = (
                <DialogFooter>
                    <PrimaryButton text="Close" onClick={cancelHandler} />
                </DialogFooter>
            );
        }

        return (
            <Dialog
                hidden={uiState.pendingSheet == undefined}
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
        const uiState: UIState = props.appState.uiState;

        const sheetsUrlChangeHandler = React.useCallback(
            (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
                const sheetsId: string | undefined = Sheets.getSheetsId(newValue);
                if (sheetsId != undefined) {
                    uiState.updatePendingSheetId(sheetsId);
                } else {
                    uiState.updatePendingSheetId("");
                }
            },
            [uiState]
        );

        const roundNumberChangeHandler = React.useCallback(
            (newValue: string) => {
                if (newValue == undefined) {
                    return;
                }

                const roundNumber: number = parseInt(newValue, 10);
                if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > maximumRoundNumber) {
                    // Don't accept the input if it's not a number
                    return;
                }

                uiState.updatePendingSheetRoundNumber(roundNumber);
                return roundNumber.toString();
            },
            [uiState]
        );

        const roundNumberDecrementHandler = React.useCallback(
            (newValue: string) => {
                const roundNumber: number = parseInt(newValue, 10);
                if (isNaN(roundNumber) || roundNumber <= 1) {
                    return;
                }

                const newRoundNumber: number = roundNumber - 1;
                uiState.updatePendingSheetRoundNumber(newRoundNumber);
                return newRoundNumber.toString();
            },
            [uiState]
        );

        const roundNumberIncrementHandler = React.useCallback(
            (newValue: string) => {
                const roundNumber: number = parseInt(newValue, 10);
                if (isNaN(roundNumber) || roundNumber >= maximumRoundNumber) {
                    return;
                }

                const newRoundNumber: number = roundNumber + 1;
                uiState.updatePendingSheetRoundNumber(newRoundNumber);
                return newRoundNumber.toString();
            },
            [uiState]
        );

        const sheet: IPendingSheet | undefined = uiState.pendingSheet;
        if (sheet === undefined) {
            return <></>;
        }

        const roundNumber: number = sheet.roundNumber ?? 1;

        // It would be great to make the TextField wider, but that requires some changes to the dialog width that
        // Fluent UI hates to do
        return (
            <Stack tokens={settingsStackTokens}>
                <TextField
                    label="SheetsUrl"
                    required={true}
                    onChange={sheetsUrlChangeHandler}
                    onGetErrorMessage={validateSheetsUrl}
                    validateOnFocusOut={true}
                    validateOnLoad={false}
                    autoFocus={true}
                />
                <SpinButton
                    defaultValue={"1"}
                    label="Round Number"
                    onIncrement={roundNumberIncrementHandler}
                    onDecrement={roundNumberDecrementHandler}
                    onValidate={roundNumberChangeHandler}
                    value={roundNumber.toString()}
                    min={1}
                    max={maximumRoundNumber}
                    step={1}
                    incrementButtonAriaLabel={"Increase round nubmer by 1"}
                    decrementButtonAriaLabel={"Decrease round number by 1"}
                />
            </Stack>
        );
    }
);

function validateSheetsUrl(url: string): string | undefined {
    // TODO: Move to Sheets.ts?
    if (url == undefined) {
        return undefined;
    } else if (url.trim() === "") {
        return "URL is required";
    }

    url = url.trim();
    if (!url.startsWith(sheetsPrefix)) {
        return `The URL must start with \"${sheetsPrefix}\"`;
    }

    return undefined;
}

const ExportStatusBody = observer(
    (props: IExportDialogProps): JSX.Element => {
        const sheet: SheetState | undefined = props.appState.uiState.sheetsState;
        if (sheet === undefined) {
            return <></>;
        }

        return <Label>{sheet.exportStatus?.status}</Label>;
    }
);

function onExport(props: IExportDialogProps): void {
    const uiState: UIState = props.appState.uiState;

    if (uiState.pendingSheet == undefined) {
        hideDialog(props);
        return;
    }

    if (
        uiState.pendingSheet.roundNumber == undefined ||
        uiState.pendingSheet.sheetId == undefined ||
        uiState.pendingSheet.sheetId.trim() === ""
    ) {
        return;
    }

    uiState.sheetsState.setRoundNumber(uiState.pendingSheet.roundNumber);
    uiState.sheetsState.setSheetId(uiState.pendingSheet.sheetId);

    Sheets.exportToSheet(props.appState);
    return;
}

function onClose(props: IExportDialogProps): void {
    hideDialog(props);
}

function hideDialog(props: IExportDialogProps): void {
    const uiState: UIState = props.appState.uiState;
    uiState.resetPendingSheet();
    uiState.sheetsState.clearRoundNumber();
    uiState.sheetsState.clearExportStatus();
}

export interface IExportDialogProps {
    appState: AppState;
}
