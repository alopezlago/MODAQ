import * as React from "react";
import { observer } from "mobx-react-lite";
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
    Icon,
    StackItem,
    IIconStyles,
    Dropdown,
    IDropdownOption,
} from "@fluentui/react";

import * as Sheets from "src/sheets/Sheets";
import { UIState } from "src/state/UIState";
import { IPendingSheet } from "src/state/IPendingSheet";
import { ExportState, SheetType } from "src/state/SheetState";
import { AppState } from "src/state/AppState";
import { StateContext } from "src/contexts/StateContext";

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
    styles: {
        main: {
            top: "25vh",
        },
    },
};

const warningIconStyles: IIconStyles = {
    root: {
        marginRight: 5,
    },
};

const typeOptions: IDropdownOption[] = [
    {
        key: SheetType.Lifsheets,
        text: "Lifsheets",
    },
    {
        key: SheetType.TJSheets,
        text: "TJ Sheets",
    },
    {
        key: SheetType.UCSDSheets,
        text: "UCSD Sheets",
    },
];

const maximumRoundNumber = 30;
const sheetsPrefix = "https://docs.google.com/spreadsheets/d/";

const settingsStackTokens: Partial<IStackTokens> = { childrenGap: 10 };

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const ExportToSheetsDialog = observer(
    function ExportToSheetsDialog(): JSX.Element  {
        const appState: AppState = React.useContext(StateContext);
        const uiState: UIState = appState.uiState;
        const cancelHandler = React.useCallback(() => onClose(appState), [appState]);

        let footer: JSX.Element | undefined;
        if (
            uiState.sheetsState?.exportState == undefined ||
            uiState.sheetsState.exportState === ExportState.OverwritePrompt
        ) {
            // Can't use React.useCallback since it only appears in the first stage
            const exportHandler = () => onExport(appState);

            const exportDisabled: boolean = (uiState.pendingSheet?.sheetId ?? "") === "";
            const exportText: string =
                uiState.sheetsState.exportState === ExportState.OverwritePrompt ? "Continue" : "Export";
            footer = (
                <DialogFooter>
                    <DefaultButton text="Cancel" onClick={cancelHandler} autoFocus={false} />
                    <PrimaryButton
                        text={exportText}
                        onClick={exportHandler}
                        disabled={exportDisabled}
                        autoFocus={false}
                    />
                </DialogFooter>
            );
        } else {
            const text: string =
                uiState.sheetsState.exportState === ExportState.CheckingOvewrite ||
                uiState.sheetsState.exportState === ExportState.Exporting
                    ? "Cancel"
                    : "Close";
            footer = (
                <DialogFooter>
                    <PrimaryButton text={text} onClick={cancelHandler} />
                </DialogFooter>
            );
        }

        return (
            <Dialog
                hidden={uiState.pendingSheet == undefined}
                dialogContentProps={content}
                modalProps={modalProps}
                maxWidth="40vw"
                onDismiss={cancelHandler}
            >
                <ExportSettingsDialogBody />
                {footer}
            </Dialog>
        );
    }
);

const ExportSettingsDialogBody = observer(
    function ExportSettingsDialogBody(): JSX.Element  {
        const appState: AppState = React.useContext(StateContext);
        const uiState: UIState = appState.uiState;

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

        const typeChangeHandler = React.useCallback(
            (ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
                if (option == undefined) {
                    return;
                }

                // The keys are always SheetType values
                appState.uiState.sheetsState.setSheetType(option.key as SheetType);
            },
            [appState]
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

        const selectedType: number = uiState.sheetsState.sheetType ?? SheetType.Lifsheets;
        const roundNumber: number = sheet.roundNumber ?? 1;

        let warningIconName: string | undefined;
        switch (uiState.sheetsState.exportState) {
            case ExportState.OverwritePrompt:
                warningIconName = "Warning";
                break;
            case ExportState.Error:
                warningIconName = "Error";
                break;
            default:
                warningIconName = undefined;
                break;
        }

        const warningIcon: JSX.Element | false = warningIconName != undefined && (
            <Icon iconName={warningIconName} styles={warningIconStyles} />
        );

        const status: string | undefined = uiState.sheetsState.exportStatus?.status;
        const controlsDisabled: boolean = uiState.sheetsState.exportState != undefined;

        // It would be great to make the TextField wider, but that requires some changes to the dialog width that
        // Fluent UI hates to do
        return (
            <Stack tokens={settingsStackTokens}>
                <StackItem>
                    <TextField
                        label="SheetsUrl"
                        defaultValue={
                            sheet.sheetId == undefined || sheet.sheetId.length === 0
                                ? ""
                                : `${sheetsPrefix}${sheet.sheetId}`
                        }
                        disabled={controlsDisabled}
                        required={true}
                        onChange={sheetsUrlChangeHandler}
                        onGetErrorMessage={validateSheetsUrl}
                        validateOnFocusOut={true}
                        validateOnLoad={false}
                        autoFocus={true}
                    />
                </StackItem>
                <StackItem>
                    <Dropdown
                        label="Type"
                        disabled={controlsDisabled}
                        options={typeOptions}
                        selectedKey={selectedType}
                        onChange={typeChangeHandler}
                    />
                </StackItem>
                <StackItem>
                    <SpinButton
                        label="Round Number"
                        onIncrement={roundNumberIncrementHandler}
                        onDecrement={roundNumberDecrementHandler}
                        onValidate={roundNumberChangeHandler}
                        disabled={controlsDisabled}
                        value={roundNumber.toString()}
                        min={1}
                        max={maximumRoundNumber}
                        step={1}
                        incrementButtonAriaLabel={"Increase round nubmer by 1"}
                        decrementButtonAriaLabel={"Decrease round number by 1"}
                    />
                </StackItem>
                <StackItem>
                    <Label>
                        {warningIcon}
                        {status}
                    </Label>
                </StackItem>
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

async function onExport(appState: AppState): Promise<void> {
    const uiState: UIState = appState.uiState;

    if (uiState.pendingSheet == undefined) {
        hideDialog(appState);
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

    await Sheets.exportToSheet(appState);
}

function onClose(appState: AppState): void {
    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    const uiState: UIState = appState.uiState;
    uiState.resetPendingSheet();
    uiState.sheetsState.clearExportStatus();
}
