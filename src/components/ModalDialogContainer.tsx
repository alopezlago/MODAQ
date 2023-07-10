import React from "react";
import { observer } from "mobx-react-lite";

import { AddPlayerDialog } from "./dialogs/AddPlayerDialog";
import { NewGameDialog } from "./dialogs/NewGameDialog";
import { ExportToSheetsDialog } from "./dialogs/ExportToSheetsDialog";
import { ExportToJsonDialog } from "./dialogs/ExportToJsonDialog";
import { ImportGameDialog } from "./dialogs/ImportGameDialog";
import { FontDialog } from "./dialogs/FontDialog";
import { HelpDialog } from "./dialogs/HelpDialog";
import { CustomizeGameFormatDialog } from "./dialogs/CustomizeGameFormatDialog";
import { AddQuestionsDialog } from "./dialogs/AddQuestionsDialog";
import { MessageDialog } from "./dialogs/MessageDialog";
import { RenamePlayerDialog } from "./dialogs/RenamePlayerDialog";
import { ReorderPlayerDialog } from "./dialogs/ReorderPlayerDialog";
import { ScoresheetDialog } from "./dialogs/ScoresheetDialog";
import { StateContext } from "../contexts/StateContext";
import { AppState } from "../state/AppState";
import { ModalVisibilityStatus } from "../state/ModalVisibilityStatus";

export const ModalDialogContainer = observer(function ModalDialogContainer() {
    // The Protest dialogs aren't here because they require extra information
    const appState: AppState = React.useContext(StateContext);
    if (appState.uiState.dialogState.visibleDialog === ModalVisibilityStatus.None) {
        return <></>;
    }

    return (
        <>
            <AddPlayerDialog />
            <AddQuestionsDialog />
            <CustomizeGameFormatDialog />
            <ExportToJsonDialog />
            <ExportToSheetsDialog />
            <FontDialog />
            <HelpDialog />
            <ImportGameDialog />
            <MessageDialog />
            <NewGameDialog />
            <RenamePlayerDialog />
            <ReorderPlayerDialog />
            <ScoresheetDialog />
        </>
    );
});
