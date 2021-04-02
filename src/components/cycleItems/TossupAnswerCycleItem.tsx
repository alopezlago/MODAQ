import React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "src/state/Cycle";
import { ITossupAnswerEvent } from "src/state/Events";
import { CycleItem } from "./CycleItem";
import { IGameFormat } from "src/state/IGameFormat";

export const TossupAnswerCycleItem = observer(
    (props: ITossupAnswerCycleItemProps): JSX.Element => {
        const deleteHandler = () => {
            if (props.buzz.marker.points > 0) {
                props.cycle.removeCorrectBuzz();
            } else {
                props.cycle.removeWrongBuzz(props.buzz.marker.player, props.gameFormat);
            }
        };

        let buzzDescription = "answered";
        const points: number = props.buzz.marker.points;
        if (points === 0) {
            buzzDescription = "answered WRONGLY";
        } else if (points === props.gameFormat.negValue) {
            buzzDescription = "NEGGED";
        } else if (points === 10) {
            buzzDescription = "answered CORRECTLY";
        } else {
            const powerIndex: number = props.gameFormat.pointsForPowers.indexOf(points);
            // Add more "SUPER"s depending on the number of remaining power levels
            // Subtract 1 since the first element is for regular powers
            const superpowerLevel: number = props.gameFormat.pointsForPowers.length - powerIndex - 1;
            if (superpowerLevel === 0) {
                buzzDescription = "POWERED";
            } else {
                // Treat the 0 case as special since we don't want to create empty arrays for no reason
                buzzDescription = new Array(superpowerLevel).fill("SUPER").join("") + "POWERED";
            }
        }

        const text = `${props.buzz.marker.player.name} (${
            props.buzz.marker.player.teamName
        }) ${buzzDescription} on tossup #${props.buzz.tossupIndex + 1} at word ${props.buzz.marker.position + 1}`;
        return <CycleItem text={text} onDelete={deleteHandler} />;
    }
);

export interface ITossupAnswerCycleItemProps {
    cycle: Cycle;
    buzz: ITossupAnswerEvent;
    gameFormat: IGameFormat;
}
