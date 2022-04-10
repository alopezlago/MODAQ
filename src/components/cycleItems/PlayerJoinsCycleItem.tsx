import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "src/state/Cycle";
import { IPlayerJoinsEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";

export const PlayerJoinsCycleItem = observer(
    function PlayerJoinsCycleItem(props: IPlayerJoinsCycleItemProps): JSX.Element  {
        const deleteHandler = () => {
            props.cycle.removePlayerJoins(props.join);
        };
        return (
            <CycleItem
                text={`New player (${props.join.inPlayer.teamName}): ${props.join.inPlayer.name} joins`}
                onDelete={deleteHandler}
            />
        );
    }
);

export interface IPlayerJoinsCycleItemProps {
    cycle: Cycle;
    join: IPlayerJoinsEvent;
}
