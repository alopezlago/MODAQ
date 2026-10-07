import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets, memoizeFunction, ThemeContext, Theme } from "@fluentui/react";

import type { IFormattedText } from "../parser/IFormattedText";
import { FormattedText } from "./FormattedText";

export const QuestionWord = observer(function QuestionWord(props: IQuestionWordProps): JSX.Element {
    return (
        <ThemeContext.Consumer>
            {(theme) => {
                // The space above the word is held open while numbering is on, so numbers appearing don't shift
                // the text. When the moderator would rather keep the line spacing tight, it isn't reserved, and
                // the row only shows up for the words that have a number to show.
                const showIndexLabel: boolean = props.reserveIndexSpace === true || props.displayIndex != undefined;
                const classes = getClassNames(
                    theme,
                    props.selected,
                    props.correct,
                    props.wrong,
                    props.index != undefined,
                    showIndexLabel
                );
                return (
                    <span
                        ref={props.componentRef}
                        data-index={props.index}
                        data-is-focusable="true"
                        className={props.index != undefined ? `${classes.word} word-${props.index}` : classes.word}
                    >
                        {showIndexLabel && (
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
        showIndexLabel: boolean
    ): IQuestionWordClassNames =>
        mergeStyleSets({
            indexLabel: {
                // Small, non-bold number sitting directly above the word. The numbers only show while the
                // moderator is marking a buzz, so they're dark enough to read at a glance.
                fontSize: "0.7em",
                lineHeight: 1,
                fontWeight: "normal",
                color: theme ? theme.palette.neutralSecondary : "rgb(96, 96, 96)",
                userSelect: "none",
            },
            word: [
                // While numbering words, stack the number on top of the word; otherwise lay words out inline
                showIndexLabel
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
