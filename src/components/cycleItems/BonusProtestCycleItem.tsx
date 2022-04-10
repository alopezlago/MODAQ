import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "src/state/Cycle";
import { IBonusProtestEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";

export const BonusProtestCycleItem = observer(
    function BonusProtestCycleItem(props: IBonusProtestCycleItemProps): JSX.Element  {
        const deleteHandler = () => {
            props.cycle.removeBonusProtest(props.protest.partIndex);
        };

        const text = `${props.protest.teamName} protests bonus #${props.protest.questionIndex + 1}, part ${
            props.protest.partIndex + 1
        }  (answer given: "${props.protest.givenAnswer}")`;

        return <CycleItem text={text} onDelete={deleteHandler} />;
    }
);

export interface IBonusProtestCycleItemProps {
    cycle: Cycle;
    protest: IBonusProtestEvent;
}
