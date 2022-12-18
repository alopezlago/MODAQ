import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets, memoizeFunction, ThemeContext, Theme } from "@fluentui/react";

import { IFormattedText } from "../parser/IFormattedText";
import { FormattedText } from "./FormattedText";

export const QuestionWord = observer(function QuestionWord(props: IQuestionWordProps): JSX.Element {
    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classes = getClassNames(
                    theme,
                    props.selected,
                    props.correct,
                    props.wrong,
                    props.index != undefined
                );
                return (
                    <span
                        ref={props.componentRef}
                        data-index={props.index}
                        data-is-focusable="true"
                        className={classes.word}
                    >
                        <FormattedText segments={props.word} />
                    </span>
                );
            }}
        </ThemeContext.Consumer>
    );
});

interface IQuestionWordProps {
    word: IFormattedText[];
    index: number | undefined;
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
        theme: Theme | undefined,
        selected: boolean | undefined,
        correct: boolean | undefined,
        wrong: boolean | undefined,
        isIndexDefined: boolean
    ): IQuestionWordClassNames =>
        mergeStyleSets({
            word: [
                { display: "inline-flex" },
                selected && {
                    fontWeight: "bold",
                    background: theme ? theme.palette.themeLight + "20" : "rbg(192, 192, 192)",
                },
                correct && {
                    background: theme ? theme.palette.tealLight + "20" : "rbg(0, 128, 128)",
                    textDecoration: "underline solid",
                },
                wrong && {
                    background: theme ? theme.palette.red + "20" : "rgb(128, 0, 0)",
                    textDecoration: "underline wavy",
                },
                correct &&
                    wrong && {
                        background: theme ? theme.palette.neutralLight : "rgb(128, 128, 128)",
                        textDecoration: "underline double",
                    },
                // Only highlight a word on hover if it's not in an existing state from selected/correct/wrong
                isIndexDefined &&
                    !(selected || correct || wrong) && {
                        "&:hover": {
                            background: theme ? theme.palette.themeLighter : "rgb(200, 200, 0)",
                        },
                    },
            ],
        })
);
