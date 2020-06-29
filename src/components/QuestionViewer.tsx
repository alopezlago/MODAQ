import React from "react";
import { observer } from "mobx-react";
import { createUseStyles } from "react-jss";

import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";
import { TossupQuestion } from "./TossupQuestion";
import { BonusQuestion } from "./BonusQuestion";
import { Cycle } from "src/state/Cycle";

export const QuestionViewer = observer((props: IQuestionViewerProps) => {
    const classes: IQuestionViewerStyle = useStyles();

    const cycle: Cycle = props.game.cycles[props.uiState.cycleIndex];
    const tossupIndex: number = props.game.getTossupIndex(props.uiState.cycleIndex);
    const bonusIndex: number = props.game.getBonusIndex(props.uiState.cycleIndex);

    let bonus: JSX.Element | null = null;
    const bonusInPlay: boolean = cycle.correctBuzz != undefined;
    if (bonusIndex >= 0 && bonusIndex < props.game.packet.bonsues.length) {
        bonus = (
            <BonusQuestion
                bonus={props.game.packet.bonsues[bonusIndex]}
                bonusIndex={bonusIndex}
                cycle={cycle}
                uiState={props.uiState}
                inPlay={bonusInPlay}
            />
        );
    } else {
        // TODO: Allow users to add more bonuses (maybe by appending to a packet)
        bonus = (
            <div>
                No more bonuses available. You will need to get some bonuses elsewhere, and tally this score elsewhere.
            </div>
        );
    }

    let tossup: JSX.Element | null = null;
    if (tossupIndex >= 0 && tossupIndex < props.game.packet.tossups.length) {
        tossup = (
            <TossupQuestion
                bonusIndex={bonusIndex}
                tossupNumber={tossupIndex + 1}
                cycle={cycle}
                tossup={props.game.packet.tossups[tossupIndex]}
                game={props.game}
                uiState={props.uiState}
            />
        );
    } else {
        // TODO: Allow users to add more tossups (maybe by appending to a packet)
        // TODO: Move this and the bonus error message inside the components? Then it would be styled properly
        tossup = (
            <div>
                No more tossups available. You will need to get tiebreaker questions, and tally this score elsewhere.
            </div>
        );
    }

    // TODO: Handle the case where tossup is undefined. Alternatively, we need to disable the throw out question button
    // when we're on the last tossup.
    // This also means we need a way to import more questions when we need tiebreakers.

    return (
        <div className={classes.questionViewer}>
            {tossup}
            <div className={classes.separator} />
            {bonus}
        </div>
    );
});

export interface IQuestionViewerProps {
    game: GameState;
    uiState: UIState;
}

interface IQuestionViewerStyle {
    questionViewer: string;
    separator: string;
}

const useStyles: (data?: unknown) => IQuestionViewerStyle = createUseStyles({
    questionViewer: {
        border: "1px solid darkgray",
        padding: "5px 10px",
    },
    separator: {
        borderTop: "1px dotted black",
        margin: "10px 0",
    },
});
