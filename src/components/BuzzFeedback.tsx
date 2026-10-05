import * as React from "react";
import { observer } from "mobx-react-lite";
import { keyframes, Layer, memoizeFunction, mergeStyleSets, Theme, ThemeContext } from "@fluentui/react";

import { AppState } from "../state/AppState";
import { IBuzzFeedback } from "../state/UIState";

// How long the banner shows; its animation is timed to match
const feedbackDurationInMs = 2200;

/**
 * A banner that pops up for a moment when a buzz is recorded from the player pad, so it's clear at a glance who
 * got it right (green) or wrong (red), and for how many points.
 */
export const BuzzFeedback = observer(function BuzzFeedback(props: IBuzzFeedbackProps): JSX.Element | null {
    const feedback: IBuzzFeedback | undefined = props.appState.uiState.buzzFeedback;
    const feedbackId: number | undefined = feedback?.id;

    React.useEffect(() => {
        if (feedbackId == undefined) {
            return;
        }

        const timeoutId: number = window.setTimeout(
            () => props.appState.uiState.clearBuzzFeedback(feedbackId),
            feedbackDurationInMs
        );
        return () => window.clearTimeout(timeoutId);
    }, [props.appState, feedbackId]);

    if (feedback == undefined) {
        return null;
    }

    const symbol: string = feedback.kind === "correct" ? "✓" : feedback.kind === "wrong" ? "✗" : "↺";
    const points: string =
        feedback.kind === "removed"
            ? "buzz removed"
            : feedback.points > 0
            ? `+${feedback.points}`
            : feedback.points < 0
            ? `−${-feedback.points}`
            : "no penalty";

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classes: IBuzzFeedbackClassNames = getClassNames(theme, feedback.kind);
                return (
                    <Layer>
                        {/* The key restarts the animation for each new buzz */}
                        <div key={feedback.id} className={classes.banner} role="status" aria-live="polite">
                            <span className={classes.symbol}>{symbol}</span>
                            <span className={classes.player}>{feedback.playerName}</span>
                            <span className={classes.team}>{feedback.teamName}</span>
                            <span className={classes.points}>{points}</span>
                        </div>
                    </Layer>
                );
            }}
        </ThemeContext.Consumer>
    );
});

export interface IBuzzFeedbackProps {
    appState: AppState;
}

interface IBuzzFeedbackClassNames {
    banner: string;
    symbol: string;
    player: string;
    team: string;
    points: string;
}

// Pops in with a little overshoot, holds, then fades and sinks away
const bannerAnimation: string = keyframes({
    "0%": { opacity: 0, transform: "translateX(-50%) translateY(16px) scale(0.85)" },
    "12%": { opacity: 1, transform: "translateX(-50%) translateY(0) scale(1.06)" },
    "20%": { transform: "translateX(-50%) scale(1)" },
    "80%": { opacity: 1, transform: "translateX(-50%) scale(1)" },
    "100%": { opacity: 0, transform: "translateX(-50%) translateY(8px) scale(0.98)" },
});

const getClassNames = memoizeFunction(
    (theme: Theme | undefined, kind: IBuzzFeedback["kind"]): IBuzzFeedbackClassNames => {
        const color: string =
            kind === "correct"
                ? theme
                    ? theme.palette.green
                    : "rgb(16, 124, 16)"
                : kind === "wrong"
                ? theme
                    ? theme.palette.red
                    : "rgb(232, 17, 35)"
                : theme
                ? theme.palette.neutralSecondary
                : "gray";
        return mergeStyleSets({
            banner: {
                position: "fixed",
                left: "50%",
                bottom: "32px",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "baseline",
                gap: "12px",
                padding: "14px 28px",
                borderRadius: "12px",
                background: color,
                color: "white",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
                zIndex: 1100,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                animationName: bannerAnimation,
                animationDuration: `${feedbackDurationInMs}ms`,
                animationTimingFunction: "ease-out",
                animationFillMode: "forwards",
            },
            symbol: {
                fontSize: "28px",
                fontWeight: 700,
            },
            player: {
                fontSize: "24px",
                fontWeight: 600,
            },
            team: {
                fontSize: "16px",
                opacity: 0.85,
            },
            points: {
                fontSize: "22px",
                fontWeight: 700,
            },
        });
    }
);
