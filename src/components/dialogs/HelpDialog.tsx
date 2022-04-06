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
import { StateContext } from "src/contexts/StateContext";

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
    function HelpDialog(): JSX.Element  {
        const appState: AppState = React.useContext(StateContext);
        const closeHandler = React.useCallback(() => hideDialog(appState), [appState]);

        return (
            <Dialog
                hidden={!appState.uiState.dialogState.helpDialogVisible}
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
    function HelpDialogBody(): JSX.Element  {
        const appState: AppState = React.useContext(StateContext);
        const version: string | undefined = appState.uiState.buildVersion && `Version: ${appState.uiState.buildVersion}`;

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

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideHelpDialog();
}
