import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    Stack,
    StackItem,
    Label,
    PivotItem,
    Pivot,
    ContextualMenu,
    IModalProps,
    IDialogContentProps,
} from "@fluentui/react";

import * as ImportFromQBJDialogController from "./ImportFromQBJDialogController";
import { AppState } from "../../state/AppState";
import { PacketLoader } from "../PacketLoader";
import { StateContext } from "../../contexts/StateContext";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";
import { ImportFromQBJDialogState, ImportFromQBJPivotKey } from "../../state/ImportFromQBJDialogState";
import { CustomizeGameFormatForm } from "../CustomizeGameFormatForm";
import { FilePickerWithStatus } from "../FilePickerWithStatus";

const modalProps: IModalProps = {
    isBlocking: false,
    dragOptions: {
        moveMenuItemText: "Move",
        closeMenuItemText: "Close",
        menu: ContextualMenu,
    },
    styles: {
        main: {
            // To have max width respected normally, we'd need to pass in an IDialogStyleProps, but it ridiculously
            // requires you to pass in an entire theme to modify the max width. We could also use a modal, but that
            // requires building much of what Dialogs offer easily (close buttons, footer for buttons)
            minWidth: "30vw !important",
        },
    },
    topOffsetFixed: true,
};

const dialogContentProps: IDialogContentProps = {
    styles: {
        innerContent: {
            minHeight: "40vh",
        },
    },
};

export const ImportFromQBJDialog = observer(function ImportFromQBJDialog(): JSX.Element {
    return (
        <ModalDialog
            title="Import from QBJ"
            visibilityStatus={ModalVisibilityStatus.ImportFromQBJ}
            onDismiss={ImportFromQBJDialogController.hideDialog}
            modalProps={modalProps}
            dialogContentProps={dialogContentProps}
        >
            <ImportFromQBJDialogBody />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={ImportFromQBJDialogController.onSubmit} />
                <DefaultButton text="Cancel" onClick={ImportFromQBJDialogController.hideDialog} />
            </DialogFooter>
        </ModalDialog>
    );
});

const ImportFromQBJDialogBody = observer(function ImportFromQBJDialogBody(): JSX.Element {
    // Need a stack of: QBJ, packet, game format (re-use from Options, refactor if needed)
    const appState: AppState = React.useContext(StateContext);
    const dialogState: ImportFromQBJDialogState | undefined = appState.uiState.dialogState.importFromQBJDialog;

    if (dialogState == undefined) {
        return <></>;
    }

    // We need to keep the pivot key in the UI State, so if they are missing a required field we can jump right to the
    // tab
    return (
        <Stack>
            <StackItem>
                <Pivot
                    aria-label="Import from QBJ Wizard"
                    selectedKey={dialogState.pivotKey}
                    onLinkClick={onPivotLinkClick}
                >
                    <PivotItem headerText="QBJ" itemKey={ImportFromQBJPivotKey.Match}>
                        <FilePickerWithStatus
                            label="QBJ file"
                            buttonText="Load"
                            onChange={onQBJFileChange}
                            required={true}
                            status={dialogState.qbjStatus}
                        />
                    </PivotItem>
                    <PivotItem headerText="Packet" itemKey={ImportFromQBJPivotKey.Packet}>
                        <PacketLoader
                            appState={appState}
                            onLoad={ImportFromQBJDialogController.loadPacket}
                            updateFilename
                        />
                    </PivotItem>
                    <PivotItem headerText="Format" itemKey={ImportFromQBJPivotKey.Format}>
                        <CustomizeGameFormatForm state={dialogState.customizeGameFormat} />
                    </PivotItem>
                </Pivot>
            </StackItem>
            <StackItem>
                <Label>{dialogState.convertErrorMessage}</Label>
            </StackItem>
        </Stack>
    );
});

function onPivotLinkClick(item: PivotItem | undefined): void {
    if (item == undefined) {
        return;
    }

    const pivotKey = item.props.itemKey as ImportFromQBJPivotKey | undefined;
    if (pivotKey == undefined) {
        return;
    }

    ImportFromQBJDialogController.onPivotChange(pivotKey);
}

function onQBJFileChange(event: React.ChangeEvent<HTMLInputElement>, file: File): void {
    ImportFromQBJDialogController.onQBJFileChange(file);
}
