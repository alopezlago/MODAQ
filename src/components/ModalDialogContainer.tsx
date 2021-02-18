import React from "react";
import { observer } from "mobx-react-lite";

import { AppState } from "src/state/AppState";
import { AddPlayerDialog } from "./AddPlayerDialog";
import { NewGameDialog } from "./NewGameDialog";
import { ExportDialog } from "./ExportDialog";

export const ModalDialogContainer = observer((props: IModalDialogContainerProps) => {
    // The Protest dialogs aren't here because they require extra information
    return (
        <>
            <AddPlayerDialog appState={props.appState} />
            <ExportDialog appState={props.appState} />
            <NewGameDialog appState={props.appState} />
        </>
    );
});

export interface IModalDialogContainerProps {
    appState: AppState;
}
