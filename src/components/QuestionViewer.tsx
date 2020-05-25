import React from "react";
import { observer } from "mobx-react";
import { UIState } from "src/state/UIState";
import { CycleChooser } from "./CycleChooser";
import { GameState } from "src/state/GameState";

@observer
export class QuestionViewer extends React.Component<IQuestionViewerProps> {
    public render(): JSX.Element {
        return <CycleChooser {...this.props} />;
    }
}

export interface IQuestionViewerProps {
    game: GameState;
    uiState: UIState;
}