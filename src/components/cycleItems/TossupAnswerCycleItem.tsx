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
        // What this buzz actually cost, decided by the same call the SCORE is
        // decided by (Cycle.getNegBuzzes) rather than by repeating the rule
        // here. Repeating it meant assuming the team rule — only the first
        // wrong buzz on a question is a neg — so under a format that negs every
        // one of them, an individual game or a shootout, the log printed "for
        // 0 ✗" beside a buzz that had just cost the player five.
        const negs: ITossupAnswerEvent[] = props.cycle.getNegBuzzes(props.game.gameFormat);
        const actualPoints = negs.indexOf(props.buzz) >= 0 ? points : 0;
        buzzDescription = `for ${actualPoints} ✗`;
    } else {
        buzzDescription = `for ${points} ✓`;
    }

    // A one-player team (a shootout, IPNCT) is just the name: "Ann (Ann)" said it twice.
    const { name, teamName } = props.buzz.marker.player;
    const text = `${name}${teamName === name ? "" : ` (${teamName})`} ${buzzDescription}`;
    return <CycleItem text={text} onDelete={deleteHandler} />;
});

export interface ITossupAnswerCycleItemProps {
    cycle: Cycle;
    buzz: ITossupAnswerEvent;
    game: GameState;
}
