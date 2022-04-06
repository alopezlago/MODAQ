import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "src/state/Cycle";
import { ISubstitutionEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";

export const SubstitutionCycleItem = observer(
    function SubstitutionCycleItem(props: ISubstitutionCycleItemProps): JSX.Element  {
        const deleteHandler = () => {
            props.cycle.removeSubstitution(props.sub);
        };

        return (
            <CycleItem
                text={`Substitution (${props.sub.inPlayer.teamName}): ${props.sub.inPlayer.name} in for ${props.sub.outPlayer.name}`}
                onDelete={deleteHandler}
            />
        );
    }
);

export interface ISubstitutionCycleItemProps {
    cycle: Cycle;
    sub: ISubstitutionEvent;
}
