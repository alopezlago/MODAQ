import * as React from "react";
import { observer } from "mobx-react-lite";
import { DialogFooter, PrimaryButton, DefaultButton } from "@fluentui/react";

import * as AddQuestionsDialogController from "./AddQuestionsDialogController";
import { AppState } from "../../state/AppState";
import { PacketLoader } from "../PacketLoader";
import { StateContext } from "../../contexts/StateContext";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const AddQuestionsDialog = observer(function AddQuestionsDialog(): JSX.Element {
    return (
        <ModalDialog
            title="Add Questions"
            visibilityStatus={ModalVisibilityStatus.AddQuestions}
            onDismiss={AddQuestionsDialogController.cancel}
        >
            <AddQuestionsDialogBody />
            <DialogFooter>
                <PrimaryButton text="Load" onClick={AddQuestionsDialogController.commit} />
                <DefaultButton text="Cancel" onClick={AddQuestionsDialogController.cancel} />
            </DialogFooter>
        </ModalDialog>
    );
});

const AddQuestionsDialogBody = observer(function AddQuestionsDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    return <PacketLoader appState={appState} onLoad={AddQuestionsDialogController.loadPacket} />;
});
