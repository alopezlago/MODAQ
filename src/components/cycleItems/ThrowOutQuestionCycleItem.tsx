import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "src/state/Cycle";
import { IThrowOutQuestionEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";

export const ThrowOutQuestionCycleItem = observer(
    function ThrowOutQuestionCycleItem(props: IThrowOutQuestionCycleItemProps): JSX.Element  {
        const questionType: string = props.isTossup ? "tossup" : "bonus";
        const text = `Threw out ${questionType} #${props.thrownOutEvent.questionIndex + 1}`;
        let deleteHandler: (() => void) | undefined = undefined;

        // We only want to allow removing the last thrown out question, so we don't have ordering issues when calculating
        // the next question index
        if (props.isLastThrownOutQuestion) {
            deleteHandler = () => {
                if (props.isTossup) {
                    props.cycle.removeThrownOutTossup(props.thrownOutEvent.questionIndex);
                } else {
                    props.cycle.removeThrownOutBonus(props.thrownOutEvent.questionIndex);
                }
            };
        }

        return <CycleItem text={text} onDelete={deleteHandler} />;
    }
);

export interface IThrowOutQuestionCycleItemProps {
    cycle: Cycle;
    thrownOutEvent: IThrowOutQuestionEvent;
    isTossup: boolean;
    isLastThrownOutQuestion: boolean;
}
