import React from "react";
import { observer } from "mobx-react-lite";
import {
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    ContextualMenu,
    DialogType,
    IDialogContentProps,
    IModalProps,
    SpinButton,
} from "@fluentui/react";
import { AppState } from "src/state/AppState";
import { StateContext } from "src/contexts/StateContext";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Font",
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

const minimumFontSize = 12;
const maximumFontSize = 40;

export const FontDialog = observer(
    (): JSX.Element => {
        const appState: AppState = React.useContext(StateContext);
        const closeHandler = React.useCallback(() => hideDialog(appState), [appState]);
        const submitHandler = React.useCallback(() => updateFont(appState), [appState]);

        return (
            <Dialog
                hidden={appState.uiState.pendingQuestionFontSize == undefined}
                dialogContentProps={content}
                modalProps={modalProps}
                maxWidth="40vw"
                onDismiss={closeHandler}
            >
                <FontDialogBody />
                <DialogFooter>
                    <PrimaryButton text="OK" onClick={submitHandler} />
                    <DefaultButton text="Cancel" onClick={closeHandler} />
                </DialogFooter>
            </Dialog>
        );
    }
);

const FontDialogBody = observer(
    (): JSX.Element => {
        const appState: AppState = React.useContext(StateContext);
        const changeHandler = React.useCallback(
            (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) => {
                if (newValue == undefined) {
                    return;
                }

                const size = Number.parseInt(newValue, 10);
                if (!isNaN(size)) {
                    appState.uiState.setPendingQuestionFontSize(size);
                }
            },
            [appState]
        );

        const value: string = (
            appState.uiState.pendingQuestionFontSize ?? appState.uiState.questionFontSize
        ).toString();

        return (
            <SpinButton
                label="Font size (question)"
                onChange={changeHandler}
                value={value}
                min={minimumFontSize}
                max={maximumFontSize}
                step={1}
                incrementButtonAriaLabel={"Increase font size by 1"}
                decrementButtonAriaLabel={"Decrease font size by 1"}
            />
        );
    }
);

function updateFont(appState: AppState): void {
    appState.uiState.setQuestionFontSize(appState.uiState.pendingQuestionFontSize ?? minimumFontSize);
    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    appState.uiState.resetPendingQuestionFontSize();
}
