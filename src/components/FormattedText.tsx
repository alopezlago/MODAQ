import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets, memoizeFunction } from "@fluentui/react";

import { IFormattedText } from "src/parser/IFormattedText";

export const FormattedText = observer(
    (props: IFormattedTextProps): JSX.Element => {
        const classes: IFormattedTextClassNames = useStyles();
        const elements: JSX.Element[] = [];
        for (let i = 0; i < props.segments.length; i++) {
            elements.push(<FormattedSegment key={`segment_${i}`} classNames={classes} segment={props.segments[i]} />);
        }

        const className: string = props.className ? `${classes.text} ${props.className}` : classes.text;
        return <div className={className}>{elements}</div>;
    }
);

const FormattedSegment = observer((props: IFormattedSegmentProps) => {
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
    (): IFormattedTextClassNames =>
        mergeStyleSets({
            text: {
                display: "inline",
            },
            pronunciationGuide: {
                color: "rgb(128, 128, 128)",
            },
        })
);
