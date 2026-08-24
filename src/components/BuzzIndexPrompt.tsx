import * as React from "react";
import { observer } from "mobx-react-lite";
import { memoizeFunction, mergeStyleSets, Theme, useTheme } from "@fluentui/react";

import { AppState } from "../state/AppState";
import { useAppState } from "../contexts/StateContext";

/**
 * The status line for "type word number to buzz" mode: how to start entry, and the number typed so far. It lives
 * under the question box rather than in it, so it doesn't compete with the question text while the moderator reads.
 */
export const BuzzIndexPrompt = observer(function BuzzIndexPrompt() {
    const appState: AppState = useAppState();

    // Read the observables here, in the component's own render, so the observer re-runs when they change
    const isEnteringBuzzIndex: boolean = appState.uiState.isEnteringBuzzIndex;
    const buzzIndexEntryValue: string = appState.uiState.buzzIndexEntryValue;

    const theme: Theme = useTheme();
    const classes: IBuzzIndexPromptClassNames = getClassNames(theme);

    if (!appState.game.isLoaded || !appState.uiState.typeBuzzIndexMode) {
        return <></>;
    }

    if (!isEnteringBuzzIndex) {
        return <div className={classes.prompt}>Press Space, then type a word&apos;s number to set the buzz point.</div>;
    }

    return (
        <div className={classes.prompt}>
            Type a word&apos;s number, then Enter to buzz there (Esc to cancel):{" "}
            <strong className={classes.value}>{buzzIndexEntryValue || "—"}</strong>
        </div>
    );
});

interface IBuzzIndexPromptClassNames {
    prompt: string;
    value: string;
}

const getClassNames = memoizeFunction(
    (theme: Theme | undefined): IBuzzIndexPromptClassNames =>
        mergeStyleSets({
            prompt: {
                fontSize: "0.9em",
                color: theme ? theme.palette.neutralSecondary : "rgb(96, 96, 96)",
            },
            // The digits are what the moderator is watching for, so they stay in the normal text color
            value: {
                color: theme ? theme.palette.neutralPrimary : "rgb(0, 0, 0)",
            },
        })
);
