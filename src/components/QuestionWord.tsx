import * as React from "react";
import { observer } from "mobx-react";
import { createUseStyles } from "react-jss";
import { IFormattedText } from "src/parser/IFormattedText";
import { FormattedText } from "./FormattedText";

export const QuestionWord = observer(
    (props: IQuestionWordProps): JSX.Element => {
        const classes = useStyles();
        let className: string = classes.word;

        if (props.selected) {
            className += " selected";
        }

        if (props.correct) {
            className += " correct";
        }

        if (props.wrong) {
            className += " wrong";
        }

        return (
            <span ref={props.componentRef} data-value={props.index} className={className}>
                <FormattedText segments={props.word} />
            </span>
        );
    }
);

interface IQuestionWordProps {
    word: IFormattedText[];
    index: number;
    selected?: boolean;
    correct?: boolean;
    wrong?: boolean;
    hovered?: boolean;
    componentRef?: React.MutableRefObject<HTMLSpanElement | null>;
}

interface IQuestionWordStyle {
    word: string;
}

// This would be a great place for theming or settings
const useStyles: (data?: unknown) => IQuestionWordStyle = createUseStyles({
    word: {
        display: "inline-flex",
        "&.selected": {
            fontWeight: "bold",
            background: "rgba(192, 192, 192, 0.1)",
        },
        "&.correct": {
            background: "rgba(0, 128, 128, 0.1)",
            textDecoration: "underline solid",
        },
        "&.wrong": {
            background: "rgba(128, 0, 0, 0.1)",
            textDecoration: "underline wavy",
        },
        "&.correct&.wrong": {
            background: "rgba(128, 128, 128, 0.2)",
            textDecoration: "underline double",
        },
    },
});
