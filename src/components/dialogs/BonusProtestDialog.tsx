import * as React from "react";
import { observer } from "mobx-react-lite";
import { Label } from "@fluentui/react";

import * as BonusProtestDialogController from "./BonusProtestDialogController";
import { ProtestDialogBase } from "./ProtestDialogBase";
import { Cycle } from "../../state/Cycle";
import { IBonusProtestEvent } from "../../state/Events";
import { Bonus } from "../../state/PacketState";
import { AppState } from "../../state/AppState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";

export const BonusProtestDialog = observer(function BonusProtestDialog(props: IBonusProtestDialogProps): JSX.Element {
    const submitHandler = React.useCallback(() => BonusProtestDialogController.commit(props.appState, props.cycle), [
        props.appState,
        props.cycle,
    ]);
    const hideDialogHandler = (): void => BonusProtestDialogController.cancel(props.appState);

    const protestEvent: IBonusProtestEvent | undefined = props.appState.uiState.pendingBonusProtestEvent;
    if (protestEvent == undefined) {
        // We shouldn't be showing anything if there's no pending bonus protest. Return undefined.
        return <></>;
    }

    return (
        <ProtestDialogBase
            appState={props.appState}
            givenAnswer={protestEvent.givenAnswer}
            hideDialog={hideDialogHandler}
            onSubmit={submitHandler}
            reason={protestEvent.reason}
            visibilityStatus={ModalVisibilityStatus.BonusProtest}
        >
            <Label>Protest for part {protestEvent.partIndex + 1}</Label>
        </ProtestDialogBase>
    );
});

export interface IBonusProtestDialogProps {
    appState: AppState;
    bonus: Bonus;
    cycle: Cycle;
}
