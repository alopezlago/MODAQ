import React from "react";
import { observer } from "mobx-react";
import { createUseStyles } from "react-jss";

import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";
import { TossupQuestion } from "./TossupQuestion";
import { Tossup } from "src/state/PacketState";
import { BonusQuestion } from "./BonusQuestion";
import { Cycle } from "src/state/Cycle";

export const QuestionViewer = observer((props: IQuestionViewerProps) => {
    const classes: IQuestionViewerStyle = useStyles();

    const tossupIndex: number = props.game.getTossupIndex(props.uiState.cycleIndex);
    if (tossupIndex > props.game.packet.tossups.length) {
        return <div>New tossups needed (past the end of the packet)</div>;
    }

    const cycle: Cycle = props.game.cycles[props.uiState.cycleIndex];
    const tossup: Tossup = props.game.packet.tossups[tossupIndex];

    const bonusIndex: number = props.game.getBonusIndex(props.uiState.cycleIndex);
    let bonus: JSX.Element | null = null;
    const bonusInPlay: boolean = props.game.cycles[tossupIndex].correctBuzz != undefined;
    if (bonusIndex < props.game.packet.bonsues.length) {
        bonus = (
            <BonusQuestion
                bonus={props.game.packet.bonsues[bonusIndex]}
                cycle={cycle}
                uiState={props.uiState}
                inPlay={bonusInPlay}
            />
        );
    }

    return (
        <div className={classes.questionViewer}>
            <TossupQuestion
                tossupNumber={tossupIndex + 1}
                cycle={cycle}
                tossup={tossup}
                game={props.game}
                uiState={props.uiState}
            />
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
