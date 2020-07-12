import * as React from "react";
import { observer } from "mobx-react";

import { ProtestDialogBase } from "./ProtestDialogBase";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import { ITossupProtestEvent } from "src/state/Events";

export const TossupProtestDialog = observer(
    (props: ITossupProtestDialogProps): JSX.Element => {
        const submitHandler = React.useCallback(() => onSubmit(props), [props]);
        const hideHandler = React.useCallback(() => props.uiState.resetPendingTossupProtest(), [props]);

        if (props.uiState.pendingTossupProtestEvent == undefined) {
            // Nothing to render if there's no pending protest event.
            return <></>;
        }

        return (
            <ProtestDialogBase
                hidden={props.uiState.pendingTossupProtestEvent == undefined}
                hideDialog={hideHandler}
                onSubmit={submitHandler}
                reason={props.uiState.pendingTossupProtestEvent?.reason}
                uiState={props.uiState}
            />
        );
    }
);

function onSubmit(props: ITossupProtestDialogProps): void {
    const pendingProtestEvent: ITossupProtestEvent | undefined = props.uiState.pendingTossupProtestEvent;
    if (pendingProtestEvent) {
        props.cycle.addTossupProtest(
            pendingProtestEvent.teamName,
            pendingProtestEvent.questionIndex,
            pendingProtestEvent.position,
            pendingProtestEvent.reason
        );
        props.uiState.resetPendingTossupProtest();
    }
}

export interface ITossupProtestDialogProps {
    cycle: Cycle;
    uiState: UIState;
}
