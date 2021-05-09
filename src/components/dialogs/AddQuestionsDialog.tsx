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

import { GameState } from "src/state/GameState";
import { AppState } from "src/state/AppState";
import { PacketLoader } from "../PacketLoader";
import { PacketState } from "src/state/PacketState";
import { AddQuestionDialogState } from "src/state/AddQuestionsDialogState";

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
export const AddQuestionsDialog = observer(
    (props: IAddQuestionsDialogPorps): JSX.Element => {
        const submitHandler = React.useCallback(() => onSubmit(props), [props]);
        const cancelHandler = React.useCallback(() => onCancel(props), [props]);

        return (
            <Dialog
                hidden={props.appState.uiState.dialogState.addQuestions === undefined}
                dialogContentProps={content}
                modalProps={modalProps}
                onDismiss={cancelHandler}
            >
                <AddQuestionsDialogBody {...props} />
                <DialogFooter>
                    <PrimaryButton text="Load" onClick={submitHandler} />
                    <DefaultButton text="Cancel" onClick={cancelHandler} />
                </DialogFooter>
            </Dialog>
        );
    }
);

const AddQuestionsDialogBody = observer(
    (props: IAddQuestionsDialogPorps): JSX.Element => {
        const loadHandler = React.useCallback(
            (packet: PacketState) => props.appState.uiState.dialogState.addQuestions?.setPacket(packet),
            [props]
        );

        return <PacketLoader appState={props.appState} onLoad={loadHandler} />;
    }
);

function onSubmit(props: IAddQuestionsDialogPorps): void {
    const game: GameState = props.appState.game;
    const state: AddQuestionDialogState | undefined = props.appState.uiState.dialogState.addQuestions;
    if (state == undefined) {
        throw new Error("Tried adding more questions without any questions");
    }

    const combinedPacket: PacketState = new PacketState();
    combinedPacket.setTossups(game.packet.tossups.concat(state.newPacket.tossups));
    combinedPacket.setBonuses(game.packet.bonuses.concat(state.newPacket.bonuses));
    game.loadPacket(combinedPacket);

    hideDialog(props);
}

function onCancel(props: IAddQuestionsDialogPorps): void {
    props.appState.uiState.clearPacketStatus();
    hideDialog(props);
}

function hideDialog(props: IAddQuestionsDialogPorps): void {
    props.appState.uiState.dialogState.hideAddQuestionsDialog();
}

export interface IAddQuestionsDialogPorps {
    appState: AppState;
}
