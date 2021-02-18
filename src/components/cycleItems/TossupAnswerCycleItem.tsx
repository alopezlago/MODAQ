import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "src/state/Cycle";
import { ITossupAnswerEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";

export const TossupAnswerCycleItem = observer(
    (props: ITossupAnswerCycleItemProps): JSX.Element => {
        const deleteHandler = () => {
            if (props.buzz.marker.correct) {
                props.cycle.removeCorrectBuzz();
            } else {
                props.cycle.removeWrongBuzz(props.buzz.marker.player);
            }
        };

        const text = `${props.buzz.marker.player.name} (${props.buzz.marker.player.teamName}) answered ${
            props.buzz.marker.correct ? "CORRECTLY" : "WRONGLY"
        } on tossup #${props.buzz.tossupIndex + 1} at word ${props.buzz.marker.position + 1}`;
        return <CycleItem text={text} onDelete={deleteHandler} />;
    }
);

export interface ITossupAnswerCycleItemProps {
    cycle: Cycle;
    buzz: ITossupAnswerEvent;
}
