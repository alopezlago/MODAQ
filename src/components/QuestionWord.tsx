import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets, memoizeFunction } from "@fluentui/react";

import { IFormattedText } from "src/parser/IFormattedText";
import { FormattedText } from "./FormattedText";

export const QuestionWord = observer(
    (props: IQuestionWordProps): JSX.Element => {
        const classes = getClassNames(
            props.selected,
            props.correct,
            props.wrong,
            props.inPronunciationGuide,
            props.index != undefined
        );

        return (
            <span ref={props.componentRef} data-index={props.index} className={classes.word}>
                <FormattedText segments={props.word} />
            </span>
        );
    }
);

interface IQuestionWordProps {
    word: IFormattedText[];
    index: number | undefined;
    inPronunciationGuide?: boolean;
    selected?: boolean;
    correct?: boolean;
    wrong?: boolean;
    hovered?: boolean;
    componentRef?: React.MutableRefObject<HTMLSpanElement | null>;
}

interface IQuestionWordClassNames {
    word: string;
}

// This would be a great place for theming or settings
const getClassNames = memoizeFunction(
    (
        selected: boolean | undefined,
        correct: boolean | undefined,
        wrong: boolean | undefined,
        isPronunciation: boolean | undefined,
        isIndexDefined: boolean
    ): IQuestionWordClassNames =>
        mergeStyleSets({
            word: [
                { display: "inline-flex" },
                selected && {
                    fontWeight: "bold",
                    background: "rgba(192, 192, 192, 0.1)",
                },
                correct && {
                    background: "rgba(0, 128, 128, 0.1)",
                    textDecoration: "underline solid",
                },
                wrong && {
                    background: "rgba(128, 0, 0, 0.1)",
                    textDecoration: "underline wavy",
                },
                correct &&
                    wrong && {
                        background: "rgba(128, 128, 128, 0.2)",
                        textDecoration: "underline double",
                    },
                isPronunciation && {
                    color: "rgb(128, 128, 128)",
                },
                // Only highlight a word on hover if it's not in an existing state from selected/correct/wrong
                isIndexDefined &&
                    !(selected || correct || wrong) && { "&:hover": { background: "rgba(200, 200, 0, 0.15)" } },
            ],
        })
);
