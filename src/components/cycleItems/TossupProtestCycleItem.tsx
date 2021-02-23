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

        // If the buzz was correct, the team name should be the other team.
        // If for some reason we can't find another team, we have to default to the team we were given
        // TODO: Handle this for the non 2-team case, if we ever decide to generalize this to multiple teams. This means
        // the dialog will need a dropdown when protesting a correct buzz
        const teamName: string =
            props.cycle.correctBuzz?.marker.player.teamName === props.protest.teamName
                ? "The other team"
                : props.protest.teamName;

        const text = `${teamName} protests tossup #${props.protest.questionIndex + 1} at word ${
            props.protest.position + 1
        }`;
        return <CycleItem text={text} onDelete={deleteHandler} />;
    }
);

export interface ITossupProtestCycleItemProps {
    cycle: Cycle;
    protest: ITossupProtestEvent;
}
