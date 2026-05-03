import * as React from "react";
import { observer } from "mobx-react-lite";

import * as FormattedTextParser from "../parser/FormattedTextParser";
import { IFormattedText } from "../parser/IFormattedText";
import { FormattedText } from "./FormattedText";
import { useAppState } from "../contexts/StateContext";
import { AppState } from "../state/AppState";

export const Answer = observer(function Answer(props: IAnswerProps): JSX.Element {
    const appState: AppState = useAppState();
    const formattedText: IFormattedText[] = FormattedTextParser.parseFormattedText(props.text.trimLeft(), {
        pronunciationGuideMarkers: appState.game.gameFormat.pronunciationGuideMarkers,
    });

    return (
        <div>
            <span className={props.className}>ANSWER: </span>
            <FormattedText segments={formattedText} className={props.className} disabled={props.disabled} />
        </div>
    );
});

export interface IAnswerProps {
    text: string;
    className?: string;
    disabled?: boolean;
}
