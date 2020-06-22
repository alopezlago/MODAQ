import * as React from "react";
import { observer } from "mobx-react";

import * as FormattedTextParser from "src/parser/FormattedTextParser";
import { IFormattedText } from "src/parser/IFormattedText";
import { FormattedText } from "./FormattedText";

export const Answer = observer(
    (props: IAnswerProps): JSX.Element => {
        const formattedText: IFormattedText[] = FormattedTextParser.parseFormattedText(props.text.trimLeft());

        return (
            <div>
                <span className={props.className}>ANSWER:&nbsp;</span>
                <FormattedText segments={formattedText} className={props.className} />
            </div>
        );
    }
);

export interface IAnswerProps {
    text: string;
    className?: string;
}
