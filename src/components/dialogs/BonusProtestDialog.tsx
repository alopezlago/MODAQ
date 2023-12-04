import * as React from "react";
import { observer } from "mobx-react-lite";
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown";

import * as BonusProtestDialogController from "./BonusProtestDialogController";
import { ProtestDialogBase } from "./ProtestDialogBase";
import { Cycle } from "../../state/Cycle";
import { IBonusProtestEvent } from "../../state/Events";
import { Bonus } from "../../state/PacketState";
import { AppState } from "../../state/AppState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";

export const BonusProtestDialog = observer(function BonusProtestDialog(props: IBonusProtestDialogProps): JSX.Element {
    const submitHandler = React.useCallback(() => BonusProtestDialogController.commit(props.cycle), [props]);

    const protestEvent: IBonusProtestEvent | undefined = props.appState.uiState.pendingBonusProtestEvent;
    if (protestEvent == undefined) {
        // We shouldn't be showing anything if there's no pending bonus protest. Return undefined.
        return <></>;
    }

    const partOptions: IDropdownOption[] = props.cycle
        .getProtestableBonusPartIndexes(props.bonus.parts.length)
        .map((index) => {
            const partText: string = (index + 1).toString();
            return {
                key: index,
                text: partText,
                selected: protestEvent.partIndex === index,
            };
        });

    const children: JSX.Element = <Dropdown label="Part" options={partOptions} onChange={onPartChange} />;

    return (
        <ProtestDialogBase
            appState={props.appState}
            givenAnswer={protestEvent.givenAnswer}
            hideDialog={BonusProtestDialogController.cancel}
            onSubmit={submitHandler}
            reason={protestEvent.reason}
            visibilityStatus={ModalVisibilityStatus.BonusProtest}
        >
            {children}
        </ProtestDialogBase>
    );
});

function onPartChange(ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
    if (option?.text != undefined) {
        BonusProtestDialogController.changePart(option.key);
    }
}

export interface IBonusProtestDialogProps {
    appState: AppState;
    bonus: Bonus;
    cycle: Cycle;
}
