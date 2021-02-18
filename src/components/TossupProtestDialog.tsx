import * as React from "react";
import { observer } from "mobx-react-lite";

import { ProtestDialogBase } from "./ProtestDialogBase";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import { ITossupProtestEvent } from "src/state/Events";
import { AppState } from "src/state/AppState";

export const TossupProtestDialog = observer(
    (props: ITossupProtestDialogProps): JSX.Element => {
        const uiState: UIState = props.appState.uiState;
        const submitHandler = React.useCallback(() => onSubmit(props), [props]);
        const hideHandler = React.useCallback(() => uiState.resetPendingTossupProtest(), [uiState]);

        if (uiState.pendingTossupProtestEvent == undefined) {
            // Nothing to render if there's no pending protest event.
            return <></>;
        }

        return (
            <ProtestDialogBase
                appState={props.appState}
                autoFocusOnReason={true}
                hidden={uiState.pendingTossupProtestEvent == undefined}
                hideDialog={hideHandler}
                onSubmit={submitHandler}
                reason={uiState.pendingTossupProtestEvent?.reason}
            />
        );
    }
);

function onSubmit(props: ITossupProtestDialogProps): void {
    const pendingProtestEvent: ITossupProtestEvent | undefined = props.appState.uiState.pendingTossupProtestEvent;
    if (pendingProtestEvent) {
        props.cycle.addTossupProtest(
            pendingProtestEvent.teamName,
            pendingProtestEvent.questionIndex,
            pendingProtestEvent.position,
            pendingProtestEvent.reason
        );
        props.appState.uiState.resetPendingTossupProtest();
    }
}

export interface ITossupProtestDialogProps {
    appState: AppState;
    cycle: Cycle;
}
