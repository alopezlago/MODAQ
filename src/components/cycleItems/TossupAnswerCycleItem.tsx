import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "../../state/Cycle";
import { ITossupAnswerEvent } from "../../state/Events";
import { CycleItem } from "./CycleItem";
import { GameState } from "../../state/GameState";

export const TossupAnswerCycleItem = observer(function TossupAnswerCycleItem(
    props: ITossupAnswerCycleItemProps
): JSX.Element {
    const deleteHandler = () => {
        if (props.buzz.marker.points > 0) {
            props.cycle.removeCorrectBuzz();
        } else {
            props.cycle.removeWrongBuzz(props.buzz.marker.player, props.game.gameFormat);
        }
    };

    let buzzDescription = "answered";
    const points: number = props.game.getBuzzValue(props.buzz);
    if (points <= 0) {
        const actualPoints = props.buzz === props.cycle.firstWrongBuzz ? points : 0;
        buzzDescription = `for ${actualPoints} ✗`;
    } else {
        buzzDescription = `for ${points} ✓`;
    }

    const text = `${props.buzz.marker.player.name} (${props.buzz.marker.player.teamName}) ${buzzDescription}`;
    return <CycleItem text={text} onDelete={deleteHandler} />;
});

export interface ITossupAnswerCycleItemProps {
    cycle: Cycle;
    buzz: ITossupAnswerEvent;
    game: GameState;
}
