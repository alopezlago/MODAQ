import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "src/state/Cycle";
import { IBonusProtestEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";

export const BonusProtestCycleItem = observer(
    (props: IBonusProtestCycleItemProps): JSX.Element => {
        const deleteHandler = () => {
            props.cycle.removeBonusProtest(props.protest.partIndex);
        };

        // If the bonus part was correct, the team isn't protesting themselves. To futureproof us from dealing with the
        // 3+ team case, call it "the other team"
        const teamName: string =
            props.cycle.bonusAnswer != undefined &&
            props.cycle.bonusAnswer?.correctParts.findIndex((part) => part.index === props.protest.partIndex) >= 0
                ? "The other team"
                : props.protest.teamName;

        const text = `${teamName} protests bonus #${props.protest.questionIndex + 1}, part ${
            props.protest.partIndex + 1
        }`;

        return <CycleItem text={text} onDelete={deleteHandler} />;
    }
);

export interface IBonusProtestCycleItemProps {
    cycle: Cycle;
    protest: IBonusProtestEvent;
}
