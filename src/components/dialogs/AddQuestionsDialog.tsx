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

import { GameState } from "../../state/GameState";
import { AppState } from "../../state/AppState";
import { PacketLoader } from "../PacketLoader";
import { PacketState } from "../../state/PacketState";
import { AddQuestionDialogState } from "../../state/AddQuestionsDialogState";
import { StateContext } from "../../contexts/StateContext";

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
    styles: {
        main: {
            top: "25vh",
        },
    },
    topOffsetFixed: true,
};

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const AddQuestionsDialog = observer(function AddQuestionsDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const submitHandler = React.useCallback(() => onSubmit(appState), [appState]);
    const cancelHandler = React.useCallback(() => onCancel(appState), [appState]);

    return (
        <Dialog
            hidden={appState.uiState.dialogState.addQuestions === undefined}
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={cancelHandler}
        >
            <AddQuestionsDialogBody />
            <DialogFooter>
                <PrimaryButton text="Load" onClick={submitHandler} />
                <DefaultButton text="Cancel" onClick={cancelHandler} />
            </DialogFooter>
        </Dialog>
    );
});

const AddQuestionsDialogBody = observer(function AddQuestionsDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const loadHandler = React.useCallback(
        (packet: PacketState) => appState.uiState.dialogState.addQuestions?.setPacket(packet),
        [appState]
    );

    return <PacketLoader appState={appState} onLoad={loadHandler} />;
});

function onSubmit(appState: AppState): void {
    const game: GameState = appState.game;
    const state: AddQuestionDialogState | undefined = appState.uiState.dialogState.addQuestions;
    if (state == undefined) {
        throw new Error("Tried adding more questions without any questions");
    }

    const combinedPacket: PacketState = new PacketState();
    combinedPacket.setTossups(game.packet.tossups.concat(state.newPacket.tossups));
    combinedPacket.setBonuses(game.packet.bonuses.concat(state.newPacket.bonuses));
    game.loadPacket(combinedPacket);

    hideDialog(appState);
}

function onCancel(appState: AppState): void {
    appState.uiState.clearPacketStatus();
    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideAddQuestionsDialog();
}
