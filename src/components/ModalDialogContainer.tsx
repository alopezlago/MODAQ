import React from "react";
import { observer } from "mobx-react-lite";

import { AppState } from "src/state/AppState";
import { AddPlayerDialog } from "./dialogs/AddPlayerDialog";
import { NewGameDialog } from "./dialogs/NewGameDialog";
import { ExportToSheetsDialog } from "./dialogs/ExportToSheetsDialog";
import { ExportToJsonDialog } from "./dialogs/ExportToJsonDialog";
import { ImportGameDialog } from "./dialogs/ImportGameDialog";
import { FontDialog } from "./dialogs/FontDialog";
import { HelpDialog } from "./dialogs/HelpDialog";
import { CustomizeGameFormatDialog } from "./dialogs/CustomizeGameFormatDialog";
import { AddQuestionsDialog } from "./dialogs/AddQuestionsDialog";

export const ModalDialogContainer = observer((props: IModalDialogContainerProps) => {
    // The Protest dialogs aren't here because they require extra information
    const appState: AppState = props.appState;

    return (
        <>
            <AddPlayerDialog appState={appState} />
            <AddQuestionsDialog appState={appState} />
            <CustomizeGameFormatDialog appState={appState} />
            <ExportToJsonDialog appState={appState} />
            <ExportToSheetsDialog appState={appState} />
            <FontDialog appState={appState} />
            <HelpDialog appState={appState} />
            <ImportGameDialog appState={appState} />
            <NewGameDialog appState={appState} />
        </>
    );
});

export interface IModalDialogContainerProps {
    appState: AppState;
}
