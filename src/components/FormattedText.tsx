import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets, memoizeFunction } from "@fluentui/react";

import { IFormattedText } from "../parser/IFormattedText";
import { StateContext } from "../contexts/StateContext";
import { AppState } from "../state/AppState";

export const FormattedText = observer(function FormattedText(props: IFormattedTextProps): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const classes: IFormattedTextClassNames = useStyles(appState.uiState.pronunciationGuideColor, props.disabled);

    const elements: JSX.Element[] = [];
    for (let i = 0; i < props.segments.length; i++) {
        elements.push(<FormattedSegment key={`segment_${i}`} classNames={classes} segment={props.segments[i]} />);
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

    // Obsolete, but here for back-compat with YAPP versions before 0.2.4
    if (props.segment.required) {
        element = (
            <u>
                <b>{element}</b>
            </u>
        );
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
}

interface IFormattedTextClassNames {
    text: string;
    pronunciationGuide: string;
}

const useStyles = memoizeFunction(
    (pronunciationGuideColor: string | undefined, disabled: boolean | undefined): IFormattedTextClassNames =>
        mergeStyleSets({
            text: {
                display: "inline",
            },
            pronunciationGuide: {
                // Don't override the color if it's disabled; the container has that responsibility
                color: disabled ? undefined : pronunciationGuideColor ?? "#777777",
            },
        })
);
