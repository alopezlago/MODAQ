import * as React from "react";
import { observer } from "mobx-react";

import { ProtestDialogBase } from "./ProtestDialogBase";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import { IBonusProtestEvent } from "src/state/Events";

export const BonusProtestDialog = observer(
    (props: IBonusProtestDialogProps): JSX.Element => {
        const submitHandler = React.useCallback((reason: string) => onSubmit(props, reason), [props]);
        const hideHandler = React.useCallback(() => props.uiState.resetPendingBonusProtest(), [props]);

        return (
            <ProtestDialogBase
                hidden={props.uiState.pendingBonusProtestEvent == undefined}
                hideDialog={hideHandler}
                onSubmit={submitHandler}
            />
        );
    }
);

function onSubmit(props: IBonusProtestDialogProps, reason: string): void {
    const pendingProtestEvent: IBonusProtestEvent | undefined = props.uiState.pendingBonusProtestEvent;
    if (pendingProtestEvent) {
        props.cycle.addBonusProtest(
            pendingProtestEvent.team,
            pendingProtestEvent.questionIndex,
            pendingProtestEvent.part,
            reason
        );
    }
}

export interface IBonusProtestDialogProps {
    cycle: Cycle;
    uiState: UIState;
}
