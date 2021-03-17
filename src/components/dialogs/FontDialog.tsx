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
    (props: IFontDialogProps): JSX.Element => {
        const closeHandler = React.useCallback(() => hideDialog(props), [props]);
        const submitHandler = React.useCallback(() => updateFont(props), [props]);

        return (
            <Dialog
                hidden={props.appState.uiState.pendingQuestionFontSize == undefined}
                dialogContentProps={content}
                modalProps={modalProps}
                maxWidth="40vw"
                onDismiss={closeHandler}
            >
                <FontDialogBody {...props} />
                <DialogFooter>
                    <PrimaryButton text="OK" onClick={submitHandler} />
                    <DefaultButton text="Cancel" onClick={closeHandler} />
                </DialogFooter>
            </Dialog>
        );
    }
);

const FontDialogBody = observer(
    (props: IFontDialogProps): JSX.Element => {
        const changeHandler = React.useCallback(
            (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) => {
                if (newValue == undefined) {
                    return;
                }

                const size = Number.parseInt(newValue, 10);
                if (!isNaN(size)) {
                    props.appState.uiState.setPendingQuestionFontSize(size);
                }
            },
            [props]
        );

        const value: string = (
            props.appState.uiState.pendingQuestionFontSize ?? props.appState.uiState.questionFontSize
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

function updateFont(props: IFontDialogProps): void {
    props.appState.uiState.setQuestionFontSize(props.appState.uiState.pendingQuestionFontSize ?? minimumFontSize);
    hideDialog(props);
}

function hideDialog(props: IFontDialogProps): void {
    props.appState.uiState.resetPendingQuestionFontSize();
}

export interface IFontDialogProps {
    appState: AppState;
}
