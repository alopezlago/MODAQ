import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets, memoizeFunction, ThemeContext, Theme } from "@fluentui/react";

import type { IFormattedText } from "../parser/IFormattedText";
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
                    props.index != undefined,
                    props.reserveIndexSpace === true,
                    props.indexActive === true
                );
                return (
                    <span
                        ref={props.componentRef}
                        data-index={props.index}
                        data-is-focusable="true"
                        className={classes.word}
                    >
                        {props.reserveIndexSpace && (
                            // Render the number for buzzable words, or a blank placeholder otherwise, so every
                            // word (and the question number / power mark) reserves the same space above it
                            <span className={classes.indexLabel}>
                                {props.displayIndex != undefined ? props.displayIndex : " "}
                            </span>
                        )}
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
    // When set, the number to display above the word (used while typing a word number to set the buzz point)
    displayIndex?: number;
    // When true, reserve the space above the word for the number, even if this word has no number, so every
    // word (and the question number / power mark) keeps consistent vertical spacing
    reserveIndexSpace?: boolean;
    // When true, the user is actively typing a number, so the numbers are shown a bit darker
    indexActive?: boolean;
    selected?: boolean;
    correct?: boolean;
    wrong?: boolean;
    hovered?: boolean;
    componentRef?: React.MutableRefObject<HTMLSpanElement | null>;
}

interface IQuestionWordClassNames {
    word: string;
    indexLabel: string;
}

// This would be a great place for theming or settings
const getClassNames = memoizeFunction(
    (
        theme: Theme | undefined,
        selected: boolean | undefined,
        correct: boolean | undefined,
        wrong: boolean | undefined,
        isIndexDefined: boolean,
        reserveIndexSpace: boolean,
        indexActive: boolean
    ): IQuestionWordClassNames =>
        mergeStyleSets({
            indexLabel: {
                // Small, non-bold number sitting directly above the word. Very light while idle so it barely
                // distracts; darker once the user starts typing a number, to make the choice easier to read.
                fontSize: "0.7em",
                lineHeight: 1,
                fontWeight: "normal",
                color: indexActive
                    ? theme
                        ? theme.palette.neutralSecondary
                        : "rgb(96, 96, 96)"
                    : theme
                    ? theme.palette.neutralQuaternaryAlt
                    : "rgb(215, 215, 215)",
                userSelect: "none",
            },
            word: [
                // While numbering words, stack the number on top of the word; otherwise lay words out inline
                reserveIndexSpace
                    ? { display: "inline-flex", flexDirection: "column", alignItems: "center" }
                    : { display: "inline-flex" },
                selected && {
                    fontWeight: "bold",
                    background: theme ? theme.palette.themeLight : "rgb(192, 192, 192)",
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
