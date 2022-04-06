import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "src/state/Cycle";
import { IPlayerLeavesEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";

export const PlayerLeavesCycleItem = observer(
    function PlayerLeavesCycleItem(props: IPlayerLeavesCycleItemProps): JSX.Element  {
        const deleteHandler = () => {
            props.cycle.removePlayerLeaves(props.leave);
        };
        return (
            <CycleItem
                text={`${props.leave.outPlayer.name} (${props.leave.outPlayer.teamName}) leaves`}
                onDelete={deleteHandler}
            />
        );
    }
);

export interface IPlayerLeavesCycleItemProps {
    cycle: Cycle;
    leave: IPlayerLeavesEvent;
}
