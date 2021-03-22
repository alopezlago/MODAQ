import React from "react";
import { observer } from "mobx-react-lite";
import {
    Dialog,
    DialogFooter,
    PrimaryButton,
    ContextualMenu,
    DialogType,
    IDialogContentProps,
    IModalProps,
    Label,
    Link,
    Stack,
    StackItem,
} from "@fluentui/react";
import { AppState } from "src/state/AppState";

declare const __BUILD_VERSION__: string;

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Help",
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

export const HelpDialog = observer(
    (props: IHelpDialogPorps): JSX.Element => {
        const closeHandler = React.useCallback(() => hideDialog(props), [props]);

        return (
            <Dialog
                hidden={!props.appState.uiState.dialogState.helpDialogVisible}
                dialogContentProps={content}
                modalProps={modalProps}
                maxWidth="30vw"
                onDismiss={closeHandler}
            >
                <HelpDialogBody />
                <DialogFooter>
                    <PrimaryButton text="Close" onClick={closeHandler} />
                </DialogFooter>
            </Dialog>
        );
    }
);

const HelpDialogBody = observer(
    (): JSX.Element => {
        const version = `Version: ${__BUILD_VERSION__}`;

        return (
            <Stack>
                <StackItem>
                    <Label>{version}</Label>
                </StackItem>
                <StackItem>
                    <Link href="https://github.com/alopezlago/MODAQ/wiki" target="_blank">
                        How to use MODAQ
                    </Link>
                </StackItem>
            </Stack>
        );
    }
);

function hideDialog(props: IHelpDialogPorps): void {
    props.appState.uiState.dialogState.hideHelpDialog();
}

export interface IHelpDialogPorps {
    appState: AppState;
}
