import * as React from "react";
import { observer } from "mobx-react-lite";
import { memoizeFunction, mergeStyleSets, Theme, ThemeContext } from "@fluentui/react";

import { AppState } from "../state/AppState";
import { UIState } from "../state/UIState";
import { Tossup } from "../state/PacketState";

// How many words of question text to show on each side of a position in the debug snippets
const snippetContextWordCount = 4;

/**
 * Diagnostics panel for the "follow reading with microphone" feature. Shows which speech engine is in use,
 * what it's doing, the last words it heard, and the buzz point it last matched, so problems (no mic
 * permission, recognition service errors, bad matches) are visible.
 */
export const ReaderFollowerDebug = observer(function ReaderFollowerDebug(props: IReaderFollowerDebugProps) {
    const uiState: UIState = props.appState.uiState;

    if (!uiState.showReaderFollowerDebug || !uiState.trackReaderWithMicrophone) {
        return null;
    }

    // Dereference the observables in the component body so mobx tracks them; reads inside the
    // ThemeContext.Consumer callback aren't tracked, so the panel wouldn't update live
    const engine: string = uiState.readerFollowerEngine ?? "(not started)";
    const status: string = uiState.readerFollowerStatus ?? "(no status reported yet)";
    const transcript: string = uiState.readerFollowerTranscript ?? "(nothing yet)";
    const lastCue: string = uiState.readerFollowerLastCue ?? "(none)";

    const questionWords: string[] = getQuestionWords(props.appState);
    const livePosition: string = describePosition(uiState.readerFollowerLivePosition, questionWords);
    const buzzPoint: string = describePosition(uiState.selectedWordIndex, questionWords);

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classes: IReaderFollowerDebugClassNames = getClassNames(theme);
                return (
                    <div className={classes.debugPanel}>
                        <div>
                            <strong>Mic tracking</strong> — Engine: {engine}
                        </div>
                        <div>Status: {status}</div>
                        <div>Heard: {transcript}</div>
                        <div>Live reader position: {livePosition}</div>
                        <div>Buzz point (set after a pause or cue): {buzzPoint}</div>
                        <div>Last immediate cue: {lastCue}</div>
                    </div>
                );
            }}
        </ThemeContext.Consumer>
    );
});

function getQuestionWords(appState: AppState): string[] {
    const tossup: Tossup | undefined = appState.game.getTossup(appState.uiState.cycleIndex);
    if (tossup == undefined) {
        return [];
    }

    return tossup
        .getWords(appState.game.gameFormat)
        .filter((word) => word.canBuzzOn)
        .map((word) => word.word.map((segment) => segment.text).join("").trim());
}

// Shows the word index plus a snippet of the question around it, with the word itself in brackets, so it's easy
// to see where in the question the position landed
function describePosition(wordIndex: number, questionWords: string[]): string {
    if (wordIndex < 0) {
        return "(not set)";
    }

    let snippet = "";
    if (wordIndex < questionWords.length) {
        const start: number = Math.max(0, wordIndex - snippetContextWordCount);
        const end: number = Math.min(questionWords.length, wordIndex + snippetContextWordCount + 1);
        const before: string = questionWords.slice(start, wordIndex).join(" ");
        const after: string = questionWords.slice(wordIndex + 1, end).join(" ");
        snippet =
            ` — "${start > 0 ? "…" : ""}${before} [${questionWords[wordIndex]}] ${after}` +
            `${end < questionWords.length ? "…" : ""}"`;
    }

    return `word index ${wordIndex}${snippet}`;
}

export interface IReaderFollowerDebugProps {
    appState: AppState;
}

interface IReaderFollowerDebugClassNames {
    debugPanel: string;
}

const getClassNames = memoizeFunction(
    (theme: Theme | undefined): IReaderFollowerDebugClassNames =>
        mergeStyleSets({
            debugPanel: {
                border: "1px dashed " + (theme ? theme.palette.neutralTertiary : "gray"),
                borderRadius: "4px",
                fontFamily: "Consolas, monospace",
                fontSize: "12px",
                lineHeight: "1.5",
                margin: "8px 0",
                padding: "6px 8px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
            },
        })
);
