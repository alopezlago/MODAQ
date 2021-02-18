import React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets } from "@fluentui/react";

import { CycleChooser } from "./CycleChooser";
import { QuestionViewer } from "./QuestionViewer";
import { AppState } from "src/state/AppState";

export const QuestionViewerContainer = observer((props: IQuestionViewerContainerProps) => {
    const classes: IQuestionViewerContainerClassNames = getClassNames();

    if (!props.appState.game.isLoaded) {
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
    appState: AppState;
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
