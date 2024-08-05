import * as React from "react";
import { observer } from "mobx-react-lite";
import { IDialogContentProps, DialogType, DialogFooter, PrimaryButton, DefaultButton } from "@fluentui/react";

import * as CustomizeGameFormatDialogController from "./CustomGameFormatDialogController";
import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";
import { CustomizeGameFormatForm } from "../CustomizeGameFormatForm";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Customize Game Format",
    closeButtonAriaLabel: "Close",
    showCloseButton: true,
    styles: {
        innerContent: {
            display: "flex",
            flexDirection: "column",
            marginBottom: 30,
        },
    },
};

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const CustomizeGameFormatDialog = observer(function CustomizeGameFormatDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    if (appState.uiState.dialogState.customizeGameFormat == undefined) {
        return <></>;
    }

    return (
        <ModalDialog
            title="Customize Game Format"
            visibilityStatus={ModalVisibilityStatus.CustomizeGameFormat}
            dialogContentProps={content}
            onDismiss={CustomizeGameFormatDialogController.cancel}
        >
            <CustomizeGameFormatForm state={appState.uiState.dialogState.customizeGameFormat} />
            <DialogFooter>
                <PrimaryButton text="Save" onClick={CustomizeGameFormatDialogController.submit} />
                <DefaultButton text="Cancel" onClick={CustomizeGameFormatDialogController.cancel} />
            </DialogFooter>
        </ModalDialog>
    );
});
