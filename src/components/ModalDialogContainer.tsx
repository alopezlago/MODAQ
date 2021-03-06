import React from "react";
import { observer } from "mobx-react-lite";

import { AppState } from "src/state/AppState";
import { AddPlayerDialog } from "./dialogs/AddPlayerDialog";
import { NewGameDialog } from "./dialogs/NewGameDialog";
import { ExportToSheetsDialog } from "./dialogs/ExportToSheetsDialog";
import { ExportToJsonDialog } from "./dialogs/ExportToJsonDialog";
import { ImportGameDialog } from "./dialogs/ImportGameDialog";

export const ModalDialogContainer = observer((props: IModalDialogContainerProps) => {
    // The Protest dialogs aren't here because they require extra information
    return (
        <>
            <AddPlayerDialog appState={props.appState} />
            <ExportToJsonDialog appState={props.appState} />
            <ExportToSheetsDialog appState={props.appState} />
            <ImportGameDialog appState={props.appState} />
            <NewGameDialog appState={props.appState} />
        </>
    );
});

export interface IModalDialogContainerProps {
    appState: AppState;
}
