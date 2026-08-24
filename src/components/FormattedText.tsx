import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets, memoizeFunction } from "@fluentui/react";

import type { IFormattedText } from "../parser/IFormattedText";
import { useAppState } from "../contexts/StateContext";
import { AppState } from "../state/AppState";

export const FormattedText = observer(function FormattedText(props: IFormattedTextProps): JSX.Element {
    const appState: AppState = useAppState();
    const classes: IFormattedTextClassNames = useStyles(
        appState.uiState.pronunciationGuideColor,
        props.disabled,
        appState.uiState.useDarkMode
    );

    // Moderators who find the anchor highlighting distracting can turn it off; the anchored words then read like
    // any other word
    const showPronunciationAnchors = !appState.uiState.hidePronunciationAnchors;

    const elements: JSX.Element[] = [];
    for (let i = 0; i < props.segments.length; i++) {
        elements.push(
            <FormattedSegment
                key={`segment_${i}`}
                classNames={classes}
                segment={props.segments[i]}
                showPronunciationAnchors={showPronunciationAnchors}
            />
        );
    }

    const className: string = props.className ? `${classes.text} ${props.className}` : classes.text;
    return <div className={className}>{elements}</div>;
});

const FormattedSegment = observer(function FormattedSegment(props: IFormattedSegmentProps) {
    // I used inline styles with divs for each individual element, but that messes up kerning when punctuation
    // following the text has a different format. Basic formatting tags (<b>, <u>, <i>) will keep them together.
    let element: JSX.Element = <>{props.segment.text}</>;
    if (props.segment.bolded) {
        element = <b>{element}</b>;
    }

    if (props.segment.emphasized) {
        element = <i>{element}</i>;
    }

    if (props.segment.underlined) {
        element = <u>{element}</u>;
    }

    if (props.segment.subscripted) {
        element = <sub>{element}</sub>;
    }

    if (props.segment.superscripted) {
        element = <sup>{element}</sup>;
    }

    // Obsolete, but here for back-compat with YAPP versions before 0.2.4
    if (props.segment.required) {
        element = (
            <u>
                <b>{element}</b>
            </u>
        );
    }

    // YAPP2: the word(s) a nearby pronunciation guide covers. Checked before `pronunciation` so that a guide
    // inside an anchor still renders as a guide.
    if (props.segment.pronunciationTarget && !props.segment.pronunciation && props.showPronunciationAnchors) {
        element = <span className={props.classNames.pronunciationTarget}>{element}</span>;
    }

    if (props.segment.pronunciation) {
        element = <span className={props.classNames.pronunciationGuide}>{element}</span>;
    }

    return element;
});

export interface IFormattedTextProps {
    segments: IFormattedText[];
    className?: string;
    disabled?: boolean;
}

interface IFormattedSegmentProps {
    segment: IFormattedText;
    classNames: IFormattedTextClassNames;
    showPronunciationAnchors: boolean;
}

interface IFormattedTextClassNames {
    text: string;
    pronunciationGuide: string;
    pronunciationTarget: string;
}

// The anchored words are colored maroon, matching QEMS3, so a reader spots the word a guide is coming for at a
// glance. True maroon disappears into the dark mode background, so that gets a lighter tint of the same hue.
const pronunciationTargetColor = "#800000";
const darkModePronunciationTargetColor = "#c46a6a";

const useStyles = memoizeFunction(
    (
        pronunciationGuideColor: string | undefined,
        disabled: boolean | undefined,
        useDarkMode: boolean
    ): IFormattedTextClassNames =>
        mergeStyleSets({
            text: {
                display: "inline",
                textDecorationSkipInk: "none",
            },
            pronunciationGuide: {
                // Don't override the color if it's disabled; the container has that responsibility
                color: disabled ? undefined : pronunciationGuideColor ?? "#777777",
            },
            pronunciationTarget: {
                // The color alone marks the anchored word(s) -- no underline, which competes with the underlining
                // the answer line and the packet's own formatting use.
                // Don't override the color if it's disabled; the container has that responsibility
                color: disabled
                    ? undefined
                    : useDarkMode
                    ? darkModePronunciationTargetColor
                    : pronunciationTargetColor,
            },
        })
);
