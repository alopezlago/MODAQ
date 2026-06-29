import React from "react";
import { observer } from "mobx-react-lite";

import { IBonusAnswerEvent, ITossupAnswerEvent } from "../../state/Events";
import { CycleItem } from "./CycleItem";

export const BonusAnswerCycleItem = observer(function BonusAnswerCycleItem(
    props: IBonusAnswerCycleItemProps
): JSX.Element {
    // Building a string through concatenation 1 character at a time is slow, but this should never be more than a few characters.
    let partIcons = "";
    let convertedPoints = 0;
    const stolenPartNumbers: number[] = [];
    let stolenPoints = 0;

    for (let i = 0; i < props.bonusAnswer.parts.length; i++) {
        const part = props.bonusAnswer.parts[i];
        if (part.points <= 0) {
            partIcons += "✗";
            continue;
        }

        if (part.teamName === props.correctBuzz.marker.player.teamName) {
            convertedPoints += part.points;
            partIcons += "✓";
        } else {
            stolenPartNumbers.push(i + 1);
            stolenPoints += part.points;
            partIcons += "✗";
        }
    }

    let text = `${props.bonusAnswer.receivingTeamName} ${convertedPoints} on bonus (${partIcons})`;
    if (stolenPoints > 0) {
        text += ` (${formatPartsText(stolenPartNumbers)} stolen for ${stolenPoints} points)`;
    }

    return <CycleItem text={text} />;
});

function formatPartsText(partNumbers: number[]): string {
    return partNumbers.length === 0 ? "no parts" : `part${partNumbers.length > 1 ? "s" : ""} ${partNumbers.join(", ")}`;
}

export interface IBonusAnswerCycleItemProps {
    bonusAnswer: IBonusAnswerEvent;
    correctBuzz: ITossupAnswerEvent;
}
