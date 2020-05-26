import * as React from "react";
import { observer } from "mobx-react";

import { UIState } from "src/state/UIState";
import { Tossup } from "src/state/PacketState";
import { QuestionWord } from "./QuestionWord";


@observer
export class TossupQuestion extends React.Component<IQuestionProps> {
    private readonly clickHandler: React.EventHandler<React.MouseEvent<HTMLDivElement>>;

    constructor(props: IQuestionProps) {
        super(props);

        this.clickHandler = (event) => this.handleClick(event);
    }

    public render(): JSX.Element {
        // TODO: Fix styles with JSS
        const questionWords = this.generateQuestionWords();
        return (
            <div className="question tossup" onClick={this.clickHandler} onDoubleClick={this.clickHandler} >
                <div className="tossup-text">
                    <span>#{this.props.tossupNumber}. </span>
                    {questionWords}
                </div>
                <div>Answer: {this.props.tossup.answer}</div>
            </div>
        );
    }

    // TODO: Cache this value, use shouldComponentUpdate to clear the cached value.
    private generateQuestionWords(): JSX.Element[] {
        return this.splitWords().map((word, index) => this.generateQuestionWord(word, index));
    }

    private generateQuestionWord(word: string, index: number) {
        // TODO: Look into using the 
        return (
            <QuestionWord key={index} index={index} word={word + " "} selected={index === this.props.uiState.selectedWordIndex} />
        );
    }

    private splitWords(): string[] {
        // If we need to worry about mulitiline, we can use /\s/mg instead
        return this.props.tossup.question.split(/\s+/g);
    }

    private handleClick(event: React.MouseEvent<HTMLDivElement>): void {
        const target = event.target as HTMLElement;
        if (target.getAttribute) {
            const index = parseInt(target.getAttribute("data-value") ?? "", 10);
            if (index >= 0) {
                const selectedIndex = this.props.uiState.selectedWordIndex === index ? -1 : index;
                this.props.uiState.setSelectedWordIndex(selectedIndex);
            }

            event.preventDefault();
            event.stopPropagation();
        }
    }
}

export interface IQuestionProps {
    tossup: Tossup;
    tossupNumber: number;
    uiState: UIState;
}
