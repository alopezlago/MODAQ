import * as React from "react";
import { observer } from "mobx-react-lite";
import { DialogFooter, PrimaryButton, DefaultButton } from "@fluentui/react";

import * as AddQuestionsDialogController from "./AddQuestionsDialogController";
import { AppState } from "../../state/AppState";
import { PacketLoader } from "../PacketLoader";
import { useAppState } from "../../contexts/StateContext";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const AddQuestionsDialog = observer(function AddQuestionsDialog(): JSX.Element {
    const appState: AppState = useAppState();

    return (
        <ModalDialog
            title="Add Questions"
            visibilityStatus={ModalVisibilityStatus.AddQuestions}
            onDismiss={() => AddQuestionsDialogController.cancel(appState)}
        >
            <AddQuestionsDialogBody appState={appState} />
            <DialogFooter>
                <PrimaryButton text="Load" onClick={() => AddQuestionsDialogController.commit(appState)} />
                <DefaultButton text="Cancel" onClick={() => AddQuestionsDialogController.cancel(appState)} />
            </DialogFooter>
        </ModalDialog>
    );
});

const AddQuestionsDialogBody = observer(function AddQuestionsDialogBody(
    props: IAddQuestionsDialogBodyProps
): JSX.Element {
    const appState: AppState = props.appState;
    return (
        <PacketLoader
            appState={appState}
            onLoad={(packet) => AddQuestionsDialogController.loadPacket(appState, packet)}
        />
    );
});

interface IAddQuestionsDialogBodyProps {
    appState: AppState;
}
