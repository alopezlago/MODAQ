import React from "react";

import { observer } from "mobx-react";
import { QuestionWord } from "./QuestionWord";
import { UIState } from "src/state/UIState";
import { IBonusPart } from "src/state/PacketState";


@observer
export class BonusQuestionPart extends React.Component<IBonusPartProps> {
    public render(): JSX.Element {
        // TODO: add checkmark button next to the part
        return (
            <div className="bonus-part">
                <div className="bonus-part-question-text">{this.props.partNumber} {this.generateQuestionWords()}</div>
                <div className="bonus-part-answer">{this.props.bonusPart.answer}</div>
            </div>
        );
    }

    private splitWords(): string[] {
        // If we need to worry about mulitiline, we can use /\s/mg instead
        return this.props.bonusPart.question.split(/\s+/g);
    }

    private generateQuestionWords(): JSX.Element[] {
        return this.splitWords().map((word, index) => this.generateQuestionWord(word, index));
    }

    private generateQuestionWord(word: string, index: number) {
        // No selection for bonuses
        // TODO: Should QuestionWord automatically include the space?
        return (
            <QuestionWord key={index} index={index} word={word + " "} selected={false} />
        );
    }
}

// TODO: Merge
export interface IBonusPartProps {
    bonusPart: IBonusPart;
    partNumber: number;
    uiState: UIState;
}