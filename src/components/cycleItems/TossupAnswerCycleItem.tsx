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
    if (points < 0 && props.buzz === props.cycle.firstWrongBuzz) {
        buzzDescription = "NEGGED";
    } else if (points <= 0) {
        buzzDescription = "answered WRONGLY";
    } else if (points === 10) {
        buzzDescription = "answered CORRECTLY";
    } else {
        const powerIndex: number = props.game.gameFormat.powers.findIndex((power) => power.points === points);
        // Add more "SUPER"s depending on the number of remaining power levels
        // Subtract 1 since the first element is for regular powers
        const superpowerLevel: number = props.game.gameFormat.powers.length - powerIndex - 1;
        if (superpowerLevel === 0 || powerIndex === -1) {
            buzzDescription = "POWERED";
        } else {
            // Treat the 0 case as special since we don't want to create empty arrays for no reason
            buzzDescription = new Array(superpowerLevel).fill("SUPER").join("") + "POWERED";
        }
    }

    const text = `${props.buzz.marker.player.name} (${props.buzz.marker.player.teamName}) ${buzzDescription}`;
    return <CycleItem text={text} onDelete={deleteHandler} />;
});

export interface ITossupAnswerCycleItemProps {
    cycle: Cycle;
    buzz: ITossupAnswerEvent;
    game: GameState;
}
