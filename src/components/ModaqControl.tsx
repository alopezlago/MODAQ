import React from "react";
import { observer } from "mobx-react-lite";

import { StateProvider } from "src/contexts/StateContext";
import { AppState } from "src/state/AppState";
import { GameViewer } from "./GameViewer";
import { ModalDialogContainer } from "./ModalDialogContainer";

export const ModaqControl = observer((props: IModaqControlProps) => {
    return (
        <StateProvider appState={props.appState}>
            <div>
                <GameViewer />
                <ModalDialogContainer />
            </div>
        </StateProvider>
    );
});

export interface IModaqControlProps {
    appState: AppState;
}
