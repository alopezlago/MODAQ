import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    IDialogContentProps,
    DialogType,
    IModalProps,
    ContextualMenu,
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
} from "@fluentui/react";

import * as AddQuestionsDialogController from "./AddQuestionsDialogController";
import { AppState } from "../../state/AppState";
import { PacketLoader } from "../PacketLoader";
import { StateContext } from "../../contexts/StateContext";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Add Questions",
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

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const AddQuestionsDialog = observer(function AddQuestionsDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    return (
        <Dialog
            hidden={appState.uiState.dialogState.visibleDialog !== ModalVisibilityStatus.AddQuestions}
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={AddQuestionsDialogController.cancel}
        >
            <AddQuestionsDialogBody />
            <DialogFooter>
                <PrimaryButton text="Load" onClick={AddQuestionsDialogController.commit} />
                <DefaultButton text="Cancel" onClick={AddQuestionsDialogController.cancel} />
            </DialogFooter>
        </Dialog>
    );
});

const AddQuestionsDialogBody = observer(function AddQuestionsDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    return <PacketLoader appState={appState} onLoad={AddQuestionsDialogController.loadPacket} />;
});
