import React from "react";
import { observer } from "mobx-react";
import { mergeStyleSets } from "@fluentui/react";

import { UIState } from "src/state/UIState";
import { CycleChooser } from "./CycleChooser";
import { GameState } from "src/state/GameState";
import { QuestionViewer } from "./QuestionViewer";

export const QuestionViewerContainer = observer((props: IQuestionViewerContainerProps) => {
    const classes: IQuestionViewerContainerClassNames = getClassNames();

    if (!props.game.isLoaded) {
        return null;
    }

    return (
        <div className="question-viewer-container">
            <div className={classes.cycleChooserContainer}>
                <CycleChooser {...props} />
            </div>
            <QuestionViewer {...props} />
        </div>
    );
});

export interface IQuestionViewerContainerProps {
    game: GameState;
    uiState: UIState;
}

interface IQuestionViewerContainerClassNames {
    cycleChooserContainer: string;
}

const getClassNames = (): IQuestionViewerContainerClassNames =>
    mergeStyleSets({
        cycleChooserContainer: {
            display: "flex",
            justifyContent: "center",
            height: "5vh",
            margin: 10,
        },
    });
