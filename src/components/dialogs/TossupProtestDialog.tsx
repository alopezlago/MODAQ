import * as React from "react";
import { observer } from "mobx-react-lite";

import * as TossupProtestDialogController from "./TossupProtestDialogController";
import { ProtestDialogBase } from "./ProtestDialogBase";
import { UIState } from "../../state/UIState";
import { Cycle } from "../../state/Cycle";
import { AppState } from "../../state/AppState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";

export const TossupProtestDialog = observer(function TossupProtestDialog(
    props: ITossupProtestDialogProps
): JSX.Element {
    const uiState: UIState = props.appState.uiState;
    const submitHandler = React.useCallback(() => TossupProtestDialogController.commit(props.appState, props.cycle), [
        props.appState,
        props.cycle,
    ]);
    const hideDialogHandler = React.useCallback(() => TossupProtestDialogController.cancel(props.appState), [
        props.appState,
    ]);

    if (uiState.pendingTossupProtestEvent == undefined) {
        // Nothing to render if there's no pending protest event.
        return <></>;
    }

    return (
        <ProtestDialogBase
            appState={props.appState}
            autoFocusOnGivenAnswer={true}
            givenAnswer={uiState.pendingTossupProtestEvent.givenAnswer}
            hideDialog={hideDialogHandler}
            onSubmit={submitHandler}
            reason={uiState.pendingTossupProtestEvent.reason}
            visibilityStatus={ModalVisibilityStatus.TossupProtest}
        />
    );
});

export interface ITossupProtestDialogProps {
    appState: AppState;
    cycle: Cycle;
}
