import * as React from "react";
import { observer } from "mobx-react-lite";
import { keyframes, mergeStyleSets, memoizeFunction, ThemeContext, Theme } from "@fluentui/react";

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
                    props.placing,
                    props.flash
                );
                return (
                    <span
                        ref={props.componentRef}
                        data-index={props.index}
                        // A pronunciation guide: a click on it means the word it is for (see wordIndexFromClickTarget)
                        data-pronunciation={props.word[0]?.pronunciation === true ? "true" : undefined}
                        data-is-focusable="true"
                        className={props.index != undefined ? `${classes.word} word-${props.index}` : classes.word}
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
    // The buzz point is being placed with the keyboard and is on this word
    placing?: boolean;
    // A buzz on this word was just recorded (or removed); the word flashes to show it
    flash?: "correct" | "wrong" | "removed";
    correct?: boolean;
    wrong?: boolean;
    hovered?: boolean;
    componentRef?: React.MutableRefObject<HTMLSpanElement | null>;
}

interface IQuestionWordClassNames {
    word: string;
}

// A strong colored pulse that fades back to the word's normal look
const getFlashAnimation = memoizeFunction((color: string): string =>
    keyframes({
        "0%": { background: color, color: "white", transform: "scale(1.25)" },
        "40%": { background: color, color: "white", transform: "scale(1)" },
        "100%": { transform: "scale(1)" },
    })
);

// This would be a great place for theming or settings
const getClassNames = memoizeFunction(
    (
        theme: Theme | undefined,
        selected: boolean | undefined,
        correct: boolean | undefined,
        wrong: boolean | undefined,
        isIndexDefined: boolean,
        placing: boolean | undefined,
        flash: "correct" | "wrong" | "removed" | undefined
    ): IQuestionWordClassNames =>
        mergeStyleSets({
            word: [
                { display: "inline-flex" },
                selected && {
                    fontWeight: "bold",
                    background: theme ? theme.palette.themeLight : "rgb(192, 192, 192)",
                },
                placing && {
                    outline: "2px solid " + (theme ? theme.palette.themePrimary : "rgb(0, 120, 212)"),
                    outlineOffset: "1px",
                },
                flash != undefined && {
                    animationName: getFlashAnimation(
                        flash === "correct"
                            ? theme
                                ? theme.palette.green
                                : "rgb(16, 124, 16)"
                            : flash === "wrong"
                            ? theme
                                ? theme.palette.red
                                : "rgb(232, 17, 35)"
                            : theme
                            ? theme.palette.neutralTertiary
                            : "gray"
                    ),
                    animationDuration: "1.2s",
                    animationTimingFunction: "ease-out",
                    borderRadius: "3px",
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
