import React from "react";
import { observer } from "mobx-react";

import { IBonusAnswerEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";

export const BonusAnswerCycleItem = observer(
    (props: IBonusAnswerCycleItemProps): JSX.Element => {
        const parts: string = props.bonusAnswer.correctParts
            .map((part) => part.index + 1)
            .sort()
            .join(", ");
        const partsText: string = parts.length === 0 ? "no parts" : `part${parts.length > 1 ? "s" : ""} ${parts}`;
        const total: number = props.bonusAnswer.correctParts.reduce(
            (previous, current) => previous + current.points,
            0
        );
        const text = `${props.bonusAnswer.receivingTeamName} answered ${partsText} correctly for ${total} points`;

        return <CycleItem text={text} />;
    }
);

export interface IBonusAnswerCycleItemProps {
    bonusAnswer: IBonusAnswerEvent;
}
