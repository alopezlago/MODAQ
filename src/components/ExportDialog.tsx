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
        const exportHandler = () => onExport(props);

        let body: JSX.Element | undefined;
        let footer: JSX.Element | undefined;
        if (props.uiState.sheetsState?.exportState == undefined) {
            body = <ExportSettingsDialogBody {...props} />;

            const exportDisabled: boolean = (props.uiState.pendingSheet?.sheetId ?? "") === "";
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

const settingsStackTokens: Partial<IStackTokens> = { childrenGap: 10 };
const sheetsPrefix = "https://docs.google.com/spreadsheets/d/";
const maximumRoundNumber = 30;

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
                if (newValue.startsWith(sheetsPrefix)) {
                    const nextSlash: number = newValue.indexOf("/", sheetsPrefix.length);
                    const sheetsId: string = newValue.substring(
                        sheetsPrefix.length,
                        nextSlash === -1 ? undefined : nextSlash
                    );

                    props.uiState.updatePendingSheetId(sheetsId.trim());
                } else {
                    props.uiState.updatePendingSheetId("");
                }
            },
            [props]
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

                props.uiState.updatePendingSheetRoundNumber(roundNumber);
                return roundNumber.toString();
            },
            [props]
        );

        const roundNumberDecrementHandler = React.useCallback(
            (newValue: string) => {
                const roundNumber: number = parseInt(newValue, 10);
                if (isNaN(roundNumber) || roundNumber <= 1) {
                    return;
                }

                const newRoundNumber: number = roundNumber - 1;
                props.uiState.updatePendingSheetRoundNumber(newRoundNumber);
                return newRoundNumber.toString();
            },
            [props]
        );

        const roundNumberIncrementHandler = React.useCallback(
            (newValue: string) => {
                const roundNumber: number = parseInt(newValue, 10);
                if (isNaN(roundNumber) || roundNumber >= maximumRoundNumber) {
                    return;
                }

                const newRoundNumber: number = roundNumber + 1;
                props.uiState.updatePendingSheetRoundNumber(newRoundNumber);
                return newRoundNumber.toString();
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
    if (url == undefined) {
        return undefined;
    } else if (url.trim() === "") {
        return "URL is required";
    }

    url = url.trim();
    if (!url.startsWith(sheetsPrefix)) {
        return "The URL must start with \"https://docs.google.com/spreadsheets/d/\"";
    }

    return undefined;
}

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

    Sheets.exportToSheet(props.game, props.uiState);
    return;
}

function onClose(props: IExportDialogProps): void {
    hideDialog(props);
}

function hideDialog(props: IExportDialogProps): void {
    props.uiState.resetPendingSheet();
    props.uiState.sheetsState.clearRoundNumber();
    props.uiState.sheetsState.clearExportStatus();
}

export interface IExportDialogProps {
    game: GameState;
    uiState: UIState;
}
