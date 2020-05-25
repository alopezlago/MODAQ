import { observer } from "mobx-react";
import React from "react";

import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";

@observer
export class CycleChooser extends React.Component<ICycleChooserProps, ICycleChooserState> {
    private static ReturnKeyCode = 13;

    public render(): JSX.Element {
        // TODO: Move away from buttons to something like images
        const moveBack: JSX.Element = (
            <button
                onClick={this.onPreviousClick}
                disabled={this.props.uiState.cycleIndex === 0}>
                &larr; Previous
            </button>
        );
        const moveForward: JSX.Element = (
            <button
                onClick={this.onNextClick}
                disabled={!this.nextDisabled()}>
                Next &rarr;
            </button>
        );

        let questionNumberViewer: JSX.Element | null = null;
        if (this.props.uiState.isEditingCycleIndex) {
            questionNumberViewer = <input
                type="text"
                value={this.state.proposedQuestionNumber}
                onBlur={this.onProposedQuestionNumberBlur}
                onChange={this.onProposedQuestionNumberChange}
                onKeyDown={this.onProposedQuestionNumberKeyDown}
                tabIndex={0}
                autoFocus={true}
            />;
        } else {
            questionNumberViewer = <span className="current-question-label" onDoubleClick={this.onQuestionLabelDoubleClick}>Question #{this.props.uiState.cycleIndex + 1}</span>;
        }

        return <div>
            {moveBack}
            {questionNumberViewer}
            {moveForward}
        </div>;
    }

    // We may want these to be computed properties in the UIState, but that requires it having access to the packet
    public nextDisabled = (): boolean => {
        return this.props.uiState.cycleIndex + 1 < this.props.game.packet.tossups.length;
    }

    public onProposedQuestionNumberBlur = (): void => {
        this.commitCycleIndex();
    }

    public onProposedQuestionNumberChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ proposedQuestionNumber: event.target.value });
    }

    public onProposedQuestionNumberKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
        if (event.which == CycleChooser.ReturnKeyCode) {
            this.commitCycleIndex();
        }
    }

    private onNextClick = (): void => {
        this.props.uiState.nextCycle();
    }

    private onPreviousClick = (): void => {
        this.props.uiState.previousCycle();
    }

    private onQuestionLabelDoubleClick = (): void => {
        // The question number is one higher than the cycle index
        this.setState({ proposedQuestionNumber: (this.props.uiState.cycleIndex + 1).toString() });
        this.props.uiState.setIsEditingCycleIndex(true);
    }

    private commitCycleIndex(): void {
        if (this.state.proposedQuestionNumber == undefined) {
            return;
        }

        const propsedCycleIndex: number = parseInt(this.state.proposedQuestionNumber, 10);
        if (propsedCycleIndex >= 1 && propsedCycleIndex <= this.props.game.packet.tossups.length) {
            this.props.uiState.setCycleIndex(propsedCycleIndex - 1);
        }

        this.props.uiState.setIsEditingCycleIndex(false);
    }
}

export interface ICycleChooserProps {
    game: GameState;
    uiState: UIState;
}

interface ICycleChooserState {
    // The question number should always be 1 higher than the cycle index
    proposedQuestionNumber: string | undefined;
}

// This can be relatively simple: just go through cycles with <- and ->
// Ideally, double-clicking on the number would let you type it in, and it would ignore it if the value was illegal