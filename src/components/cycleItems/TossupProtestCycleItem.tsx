import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "src/state/Cycle";
import { ITossupProtestEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";

export const TossupProtestCycleItem = observer(
    (props: ITossupProtestCycleItemProps): JSX.Element => {
        const deleteHandler = () => {
            props.cycle.removeTossupProtest(props.protest.teamName);
        };

        const text = `${props.protest.teamName} protests tossup #${props.protest.questionIndex + 1} at word ${
            props.protest.position + 1
        }`;
        return <CycleItem text={text} onDelete={deleteHandler} />;
    }
);

export interface ITossupProtestCycleItemProps {
    cycle: Cycle;
    protest: ITossupProtestEvent;
}
