import * as React from "react";
import { observer } from "mobx-react";

// TODO: Issue with part of this approach (around Italics, Underlines) is that it won't be as efficient since it styles
// each element, and for underlines it would be broken up.

@observer
export class QuestionWord extends React.Component<IQuestionWordProps> {
    constructor(props: IQuestionWordProps) {
        super(props);
    }

    public render(): JSX.Element {
        let className = "word";
        if (this.props.selected) {
            className += " selected";
        }

        if (this.props.italic) {
            className += " italic";
        }
        return (
            <span className={className} data-value={this.props.index}>{this.props.word}</span>
        );
    }
}

export interface IQuestionWordProps {
    word: string;
    index: number;
    italic?: boolean;
    selected?: boolean;
}
