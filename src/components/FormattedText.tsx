import * as React from "react";
import { observer } from "mobx-react";
import { createUseStyles } from "react-jss";

import { IFormattedText } from "src/parser/IFormattedText";

export const FormattedText = observer(
    (props: IFormattedTextProps): JSX.Element => {
        const classes: IFormattedTextStyle = useStyles();
        const elements: JSX.Element[] = [];
        for (let i = 0; i < props.segments.length; i++) {
            elements.push(<FormattedSegment key={`segment_${i}`} segment={props.segments[i]} />);
        }

        const className: string = props.className ? `${classes.text} ${props.className}` : classes.text;
        return <div className={className}>{elements}</div>;
    }
);

const FormattedSegment = observer((props: IFormattedSegmentProps) => {
    // I used inline styles with divs for each individual element, but that messes up kerning when punctuation
    // following the text has a different format. Basic formatting tags (<b>, <u>, <i>) will keep them together.
    let element: JSX.Element = <>{props.segment.text}</>;
    if (props.segment.emphasized) {
        element = <i>{element}</i>;
    }

    if (props.segment.required) {
        element = (
            <u>
                <b>{element}</b>
            </u>
        );
    }

    return element;
});

export interface IFormattedTextProps {
    segments: IFormattedText[];
    className?: string;
}

interface IFormattedSegmentProps {
    segment: IFormattedText;
}

interface IFormattedTextStyle {
    text: string;
}

const useStyles: (data?: unknown) => IFormattedTextStyle = createUseStyles({
    text: {
        display: "inline",
    },
});
