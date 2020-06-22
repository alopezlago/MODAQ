import * as React from "react";
import { observer } from "mobx-react";

import { ProtestDialogBase } from "./ProtestDialogBase";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import { ITossupProtestEvent } from "src/state/Events";

export const TossupProtestDialog = observer(
    (props: ITossupProtestDialogProps): JSX.Element => {
        const submitHandler = React.useCallback((reason: string) => onSubmit(props, reason), [props]);
        const hideHandler = React.useCallback(() => props.uiState.resetPendingTossupProtest(), [props]);

        return (
            <ProtestDialogBase
                hidden={props.uiState.pendingTossupProtestEvent == undefined}
                hideDialog={hideHandler}
                onSubmit={submitHandler}
            />
        );
    }
);

function onSubmit(props: ITossupProtestDialogProps, reason: string): void {
    const pendingProtestEvent: ITossupProtestEvent | undefined = props.uiState.pendingTossupProtestEvent;
    if (pendingProtestEvent) {
        props.cycle.addTossupProtest(
            pendingProtestEvent.team,
            pendingProtestEvent.questionIndex,
            pendingProtestEvent.position,
            reason
        );
    }
}

export interface ITossupProtestDialogProps {
    cycle: Cycle;
    uiState: UIState;
}
