import React from "react";
import { observer } from "mobx-react-lite";

import { UIState } from "../state/UIState";
import { GameState } from "../state/GameState";
import { TossupQuestion } from "./TossupQuestion";
import { BonusQuestion } from "./BonusQuestion";
import { Cycle } from "../state/Cycle";
import { ISeparatorStyles, IStackStyles, mergeStyleSets, Separator, Stack, StackItem } from "@fluentui/react";
import { AppState } from "../state/AppState";
import { StateContext } from "../contexts/StateContext";

const separatorStyles: Partial<ISeparatorStyles> = {
    root: {
        margin: "15px 10px",
    },
};

export const QuestionViewer = observer(function QuestionViewer() {
    const appState: AppState = React.useContext(StateContext);
    const fontSize: number = appState.uiState.questionFontSize;
    const classes: IQuestionViewerClassNames = getClassNames(fontSize);
    const game: GameState = appState.game;
    const uiState: UIState = appState.uiState;

    const cycle: Cycle = game.playableCycles[uiState.cycleIndex];
    const tossupIndex: number = game.getTossupIndex(uiState.cycleIndex);
    const bonusIndex: number = game.getBonusIndex(uiState.cycleIndex);

    // Unfortunately StackItems reset the font, so we have to override the font there
    const stackItemStyles: IStackStyles = {
        root: {
            fontSize,
        },
    };

    let bonus: JSX.Element | null = null;
    const bonusInPlay: boolean = cycle.correctBuzz != undefined;
    if (bonusIndex < 0 || bonusIndex >= game.packet.bonuses.length) {
        // TODO: Allow users to add more bonuses (maybe by appending to a packet)
        bonus = (
            <div>
                No more bonuses available. You will need to get some bonuses elsewhere, and tally this score elsewhere.
            </div>
        );
    } else if (
        !game.gameFormat.overtimeIncludesBonuses &&
        uiState.cycleIndex >= game.gameFormat.regulationTossupCount
    ) {
        bonus = <div>No bonuses during overtime.</div>;
    } else {
        bonus = (
            <BonusQuestion
                appState={appState}
                bonus={game.packet.bonuses[bonusIndex]}
                bonusIndex={bonusIndex}
                cycle={cycle}
                inPlay={bonusInPlay}
            />
        );
    }

    let tossup: JSX.Element | null = null;
    if (tossupIndex >= 0 && tossupIndex < game.packet.tossups.length) {
        tossup = (
            <TossupQuestion
                appState={appState}
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
            <Stack>
                <StackItem styles={stackItemStyles}>{tossup}</StackItem>
                <StackItem>
                    <Separator styles={separatorStyles} />
                </StackItem>
                <StackItem styles={stackItemStyles}>{bonus}</StackItem>
            </Stack>
        </div>
    );
});

interface IQuestionViewerClassNames {
    questionViewer: string;
    separator: string;
}

const getClassNames = (fontSize: number): IQuestionViewerClassNames =>
    mergeStyleSets({
        questionViewer: {
            border: "1px solid darkgray",
            padding: "5px 10px",
            fontSize,
        },
        separator: {
            borderTop: "1px dotted black",
            margin: "10px 0",
        },
    });
