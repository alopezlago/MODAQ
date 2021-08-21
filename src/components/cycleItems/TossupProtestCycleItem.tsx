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

        // If the buzz was correct, the team isn't protesting themselves. To futureproof us from dealing with the 3+
        // team case, call it "the other team"
        const teamName: string =
            props.cycle.correctBuzz?.marker.player.teamName === props.protest.teamName
                ? "The other team"
                : props.protest.teamName;

        const text = `${teamName} protests tossup #${props.protest.questionIndex + 1} at word ${
            props.protest.position + 1
        } (answer given: "${props.protest.givenAnswer}")`;
        return <CycleItem text={text} onDelete={deleteHandler} />;
    }
);

export interface ITossupProtestCycleItemProps {
    cycle: Cycle;
    protest: ITossupProtestEvent;
}
