import React from "react";
import { observer } from "mobx-react-lite";

import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";
import { TossupQuestion } from "./TossupQuestion";
import { BonusQuestion } from "./BonusQuestion";
import { Cycle } from "src/state/Cycle";
import { mergeStyleSets } from "@fluentui/react";
import { AppState } from "src/state/AppState";

export const QuestionViewer = observer((props: IQuestionViewerProps) => {
    const classes: IQuestionViewerClassNames = getClassNames();
    const game: GameState = props.appState.game;
    const uiState: UIState = props.appState.uiState;

    const cycle: Cycle = game.cycles[uiState.cycleIndex];
    const tossupIndex: number = game.getTossupIndex(uiState.cycleIndex);
    const bonusIndex: number = game.getBonusIndex(uiState.cycleIndex);

    let bonus: JSX.Element | null = null;
    const bonusInPlay: boolean = cycle.correctBuzz != undefined;
    if (bonusIndex >= 0 && bonusIndex < game.packet.bonuses.length) {
        bonus = (
            <BonusQuestion
                appState={props.appState}
                bonus={game.packet.bonuses[bonusIndex]}
                bonusIndex={bonusIndex}
                cycle={cycle}
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
    if (tossupIndex >= 0 && tossupIndex < game.packet.tossups.length) {
        tossup = (
            <TossupQuestion
                appState={props.appState}
                bonusIndex={bonusIndex}
                tossupNumber={tossupIndex + 1}
                cycle={cycle}
                tossup={game.packet.tossups[tossupIndex]}
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
    appState: AppState;
}

interface IQuestionViewerClassNames {
    questionViewer: string;
    separator: string;
}

const getClassNames = (): IQuestionViewerClassNames =>
    mergeStyleSets({
        questionViewer: {
            border: "1px solid darkgray",
            padding: "5px 10px",
        },
        separator: {
            borderTop: "1px dotted black",
            margin: "10px 0",
        },
    });
