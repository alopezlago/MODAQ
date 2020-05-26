import * as React from "react";
import { observer } from "mobx-react";

@observer
export class QuestionWord extends React.Component<IQuestionWordProps, {}> {
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
