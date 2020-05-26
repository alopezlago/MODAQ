import React from "react";
import { observer } from "mobx-react";
import { UIState } from "src/state/UIState";
import { CycleChooser } from "./CycleChooser";
import { GameState } from "src/state/GameState";
import { QuestionViewer } from "./QuestionViewer";

@observer
export class QuestionViewerContainer extends React.Component<IQuestionViewerContainerProps> {
    public render(): JSX.Element | null {
        if (!this.props.game.isLoaded) {
            return null;
        }

        return <div className="question-viewer-container">
            <QuestionViewer {...this.props} />
            <CycleChooser {...this.props} />
        </div>;
    }
}

export interface IQuestionViewerContainerProps {
    game: GameState;
    uiState: UIState;
}