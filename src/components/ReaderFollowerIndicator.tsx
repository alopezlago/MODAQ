import * as React from "react";
import { observer } from "mobx-react-lite";
import { Icon, memoizeFunction, mergeStyleSets, Theme, ThemeContext } from "@fluentui/react";

import { UIState } from "../state/UIState";

/**
 * A small microphone icon shown while the microphone is following the reader, so it's clear the mode is on. It turns
 * to a warning color while recognition is erroring or restarting; hovering shows the engine and its status.
 */
export const ReaderFollowerIndicator = observer(function ReaderFollowerIndicator(
    props: IReaderFollowerIndicatorProps
): JSX.Element | null {
    const uiState: UIState = props.uiState;
    if (!uiState.trackReaderWithMicrophone) {
        return null;
    }

    // Dereference the observables here; reads inside the ThemeContext.Consumer callback aren't tracked by mobx
    const status: string = uiState.readerFollowerStatus ?? "Starting...";
    const engine: string | undefined = uiState.readerFollowerEngine;
    const isTroubled: boolean = /error|restarting|ended/i.test(status);
    // The local model's first download takes a while; say so rather than leave the reader guessing
    const isLoading: boolean = /^Loading speech model/.test(status);
    const tooltip = `Following the reader with the microphone${engine != undefined ? ` (${engine})` : ""}: ${status}`;

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classes: IReaderFollowerIndicatorClassNames = getClassNames(theme, isTroubled);
                return (
                    <span className={classes.indicator} title={tooltip} role="img" aria-label={tooltip}>
                        <Icon iconName="Microphone" />
                        {isLoading && <span className={classes.loading}>Loading speech model…</span>}
                    </span>
                );
            }}
        </ThemeContext.Consumer>
    );
});

export interface IReaderFollowerIndicatorProps {
    uiState: UIState;
}

interface IReaderFollowerIndicatorClassNames {
    indicator: string;
    loading: string;
}

const getClassNames = memoizeFunction(
    (theme: Theme | undefined, isTroubled: boolean): IReaderFollowerIndicatorClassNames =>
        mergeStyleSets({
            indicator: {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "32px",
                height: "32px",
                fontSize: "14px",
                cursor: "default",
                color: isTroubled
                    ? theme
                        ? theme.palette.yellowDark
                        : "rgb(216, 155, 0)"
                    : theme
                    ? theme.palette.neutralTertiary
                    : "gray",
            },
            loading: {
                marginLeft: "6px",
                fontSize: "12px",
                whiteSpace: "nowrap",
            },
        })
);
