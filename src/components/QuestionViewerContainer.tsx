import React from "react";
import { createUseStyles } from "react-jss";
import { observer } from "mobx-react";

import { UIState } from "src/state/UIState";
import { CycleChooser } from "./CycleChooser";
import { GameState } from "src/state/GameState";
import { QuestionViewer } from "./QuestionViewer";

export const QuestionViewerContainer = observer((props: IQuestionViewerContainerProps) => {
    const classes: IQuestionViewerContainerStyle = useStyles();

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

interface IQuestionViewerContainerStyle {
    cycleChooserContainer: string;
}

const useStyles: (data?: unknown) => IQuestionViewerContainerStyle = createUseStyles({
    cycleChooserContainer: {
        display: "flex",
        justifyContent: "center",
        height: "5vh",
        margin: 10,
    },
});
