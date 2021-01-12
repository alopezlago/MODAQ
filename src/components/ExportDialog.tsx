import * as React from "react";
import { observer } from "mobx-react";
import {
    Dropdown,
    TextField,
    IDropdownOption,
    IDialogContentProps,
    DialogType,
    IModalProps,
    ContextualMenu,
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
} from "@fluentui/react";

import * as NewGameValidator from "src/state/NewGameValidator";
import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";
import { Player, IPlayer } from "src/state/TeamState";

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
        const exportHandler = React.useCallback(() => onExport(props), [props]);

        // The dialog footer should change: if an export hasn't started, it should be "Cancel"; if it's done, it
        // should be "close"
        const buttonText = "Cancel";

        return (
            <Dialog
                hidden={props.uiState.exportDialogVisible === false}
                dialogContentProps={content}
                modalProps={modalProps}
                onDismiss={cancelHandler}
            >
                <ExportDialogBody {...props} />
                <DialogFooter>
                    <PrimaryButton text="Cancel" onClick={cancelHandler} />
                    <DefaultButton text="Export" onClick={exportHandler} />
                </DialogFooter>
            </Dialog>
        );
    }
);

const ExportDialogBody = observer(
    (props: IExportDialogProps): JSX.Element => {
        const sheetsUrlChangeHandler = React.useCallback(
            (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
                // TODO: We need to parse the URL to get the ID
                // URLs look like https://docs.google.com/spreadsheets/d/1ZWEIXEcDPpuYhMOqy7j8uKloKJ7xrMlx8Q8y4UCbjZA/edit#gid=17040017
                // The parsing should be done in a different method or place, so we can test it
                if (newValue == undefined) {
                    return;
                }

                props.uiState.sheetsState.setSheetId(newValue);
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

                props.uiState.sheetsState.setRoundNumber(roundNumber);
            },
            [props]
        );

        // ISSUE: We're updating the state, so if they cancel, we still have these old values. This needs to belong
        // to a PendingSheetsState (minus initialized). Once we click submit, then update the actual SheetsState

        const newPlayer: IPlayer | undefined = props.uiState.pendingNewPlayer;
        if (newPlayer === undefined) {
            return <></>;
        }

        const roundNumber: number = props.uiState.sheetsState?.roundNumber ?? 1;

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

function onExport(props: IExportDialogProps): void {
    // TODO: Set the exportStatusVisible flag to true
    // Set the SheetsState to the URL and round #
    // We should have PendingExportState, since we need the URL and the round #

    hideDialog(props);
}

function onClose(props: IExportDialogProps): void {
    hideDialog(props);
}

function hideDialog(props: IExportDialogProps): void {
    props.uiState.hideExportDialog();
}

export interface IExportDialogProps {
    game: GameState;
    uiState: UIState;
}
