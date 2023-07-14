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
    const submitHandler = React.useCallback(() => TossupProtestDialogController.commit(props.cycle), [props]);

    if (uiState.pendingTossupProtestEvent == undefined) {
        // Nothing to render if there's no pending protest event.
        return <></>;
    }

    return (
        <ProtestDialogBase
            appState={props.appState}
            autoFocusOnGivenAnswer={true}
            givenAnswer={uiState.pendingTossupProtestEvent.givenAnswer}
            hidden={uiState.dialogState.visibleDialog !== ModalVisibilityStatus.TossupProtest}
            hideDialog={TossupProtestDialogController.cancel}
            onSubmit={submitHandler}
            reason={uiState.pendingTossupProtestEvent.reason}
        />
    );
});

export interface ITossupProtestDialogProps {
    appState: AppState;
    cycle: Cycle;
}
