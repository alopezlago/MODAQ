import * as React from "react";
import { observer } from "mobx-react";
import { Dropdown, IDropdownOption } from "office-ui-fabric-react/lib/Dropdown";

import { ProtestDialogBase } from "./ProtestDialogBase";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import { IBonusProtestEvent } from "src/state/Events";
import { Bonus } from "src/state/PacketState";

export const BonusProtestDialog = observer(
    (props: IBonusProtestDialogProps): JSX.Element => {
        const partChangeHandler = React.useCallback(
            (ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
                if (option?.text != undefined) {
                    props.uiState.updatePendingBonusProtestPart(option.key);
                }
            },
            [props]
        );

        const submitHandler = React.useCallback(() => onSubmit(props), [props]);
        const hideHandler = React.useCallback(() => props.uiState.resetPendingBonusProtest(), [props]);

        const protestEvent: IBonusProtestEvent | undefined = props.uiState.pendingBonusProtestEvent;
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

        const children: JSX.Element = <Dropdown label="Part" options={partOptions} onChange={partChangeHandler} />;

        return (
            <ProtestDialogBase
                hidden={props.uiState.pendingBonusProtestEvent == undefined}
                hideDialog={hideHandler}
                onSubmit={submitHandler}
                reason={protestEvent.reason}
                uiState={props.uiState}
            >
                {children}
            </ProtestDialogBase>
        );
    }
);

function onSubmit(props: IBonusProtestDialogProps): void {
    const pendingProtestEvent: IBonusProtestEvent | undefined = props.uiState.pendingBonusProtestEvent;
    if (pendingProtestEvent) {
        props.cycle.addBonusProtest(
            pendingProtestEvent.team,
            pendingProtestEvent.questionIndex,
            pendingProtestEvent.partIndex,
            pendingProtestEvent.reason
        );
        props.uiState.resetPendingBonusProtest();
    }
}

export interface IBonusProtestDialogProps {
    bonus: Bonus;
    cycle: Cycle;
    uiState: UIState;
}
