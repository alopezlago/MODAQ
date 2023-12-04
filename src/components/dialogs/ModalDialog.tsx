import * as React from "react";
import { ContextualMenu, Dialog, DialogType, IDialogContentProps, IDialogProps, IModalProps } from "@fluentui/react";
import { observer } from "mobx-react-lite";

import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { StateContext } from "../../contexts/StateContext";
import { AppState } from "../../state/AppState";

const modalProps: IModalProps = {
    isBlocking: false,
    dragOptions: {
        moveMenuItemText: "Move",
        closeMenuItemText: "Close",
        menu: ContextualMenu,
    },
    topOffsetFixed: true,
};

export const ModalDialog = observer(function ModalDialog(
    props: React.PropsWithChildren<IModalDialogProps>
): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const content: IDialogContentProps = {
        type: DialogType.normal,
        title: props.title,
        closeButtonAriaLabel: "Close",
        showCloseButton: true,
        styles: {
            innerContent: {
                display: "flex",
                flexDirection: "column",
            },
        },
    };

    return (
        <Dialog
            dialogContentProps={content}
            modalProps={modalProps}
            hidden={appState.uiState.dialogState.visibleDialog !== props.visibilityStatus}
            {...props}
        >
            {props.children}
        </Dialog>
    );
});

export interface IModalDialogProps extends IDialogProps {
    title: string;
    visibilityStatus: ModalVisibilityStatus;
}
