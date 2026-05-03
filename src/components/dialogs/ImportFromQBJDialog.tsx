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
import { useAppState } from "../../contexts/StateContext";
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
    const appState: AppState = useAppState();

    return (
        <ModalDialog
            title="Import from QBJ"
            visibilityStatus={ModalVisibilityStatus.ImportFromQBJ}
            onDismiss={() => ImportFromQBJDialogController.hideDialog(appState)}
            modalProps={modalProps}
            dialogContentProps={dialogContentProps}
        >
            <ImportFromQBJDialogBody appState={appState} />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={() => ImportFromQBJDialogController.onSubmit(appState)} />
                <DefaultButton text="Cancel" onClick={() => ImportFromQBJDialogController.hideDialog(appState)} />
            </DialogFooter>
        </ModalDialog>
    );
});

const ImportFromQBJDialogBody = observer(function ImportFromQBJDialogBody(
    props: IImportFromQBJDialogBodyProps
): JSX.Element {
    // Need a stack of: QBJ, packet, game format (re-use from Options, refactor if needed)
    const appState: AppState = props.appState;
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
                    onLinkClick={(item) => onPivotLinkClick(appState, item)}
                >
                    <PivotItem headerText="QBJ" itemKey={ImportFromQBJPivotKey.Match}>
                        <FilePickerWithStatus
                            label="QBJ file"
                            buttonText="Load"
                            onChange={(event, file) => onQBJFileChange(appState, event, file)}
                            required={true}
                            status={dialogState.qbjStatus}
                        />
                    </PivotItem>
                    <PivotItem headerText="Packet" itemKey={ImportFromQBJPivotKey.Packet}>
                        <PacketLoader
                            appState={appState}
                            onLoad={(packet) => ImportFromQBJDialogController.loadPacket(appState, packet)}
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

function onPivotLinkClick(appState: AppState, item: PivotItem | undefined): void {
    if (item == undefined) {
        return;
    }

    const pivotKey = item.props.itemKey as ImportFromQBJPivotKey | undefined;
    if (pivotKey == undefined) {
        return;
    }

    ImportFromQBJDialogController.onPivotChange(appState, pivotKey);
}

function onQBJFileChange(appState: AppState, event: React.SyntheticEvent<Element, Event>, file: File): void {
    ImportFromQBJDialogController.onQBJFileChange(appState, file);
}

interface IImportFromQBJDialogBodyProps {
    appState: AppState;
}
