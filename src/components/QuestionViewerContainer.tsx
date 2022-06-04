import React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets } from "@fluentui/react";

import { CycleChooser } from "./CycleChooser";
import { QuestionViewer } from "./QuestionViewer";
import { AppState } from "../state/AppState";
import { StateContext } from "../contexts/StateContext";

export const QuestionViewerContainer = observer(function QuestionViewerContainer() {
    const appState: AppState = React.useContext(StateContext);
    const classes: IQuestionViewerContainerClassNames = getClassNames();

    if (!appState.game.isLoaded) {
        return null;
    }

    return (
        <div className="question-viewer-container">
            <div className={classes.cycleChooserContainer}>
                <CycleChooser />
            </div>
            <QuestionViewer />
        </div>
    );
});

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
