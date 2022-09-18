import React from "react";
import { observer } from "mobx-react-lite";

import { IPlayerJoinsEvent } from "../../state/Events";
import { CycleItem } from "./CycleItem";
import { GameState } from "../../state/GameState";

export const PlayerJoinsCycleItem = observer(function PlayerJoinsCycleItem(
    props: IPlayerJoinsCycleItemProps
): JSX.Element {
    const deleteHandler = () => {
        props.game.removeNewPlayer(props.join.inPlayer);
    };
    return (
        <CycleItem
            text={`New player (${props.join.inPlayer.teamName}): ${props.join.inPlayer.name} joins`}
            onDelete={deleteHandler}
        />
    );
});

export interface IPlayerJoinsCycleItemProps {
    game: GameState;
    join: IPlayerJoinsEvent;
}
