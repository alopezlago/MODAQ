import React from "react";
import { Checkbox } from "office-ui-fabric-react/lib/Checkbox";
import { createUseStyles } from "react-jss";
import { observer } from "mobx-react";

import * as FormattedTextParser from "src/parser/FormattedTextParser";
import { UIState } from "src/state/UIState";
import { IBonusPart } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";
import { Answer } from "./Answer";
import { FormattedText } from "./FormattedText";
import { IFormattedText } from "src/parser/IFormattedText";

export const BonusQuestionPart = observer((props: IBonusQuestionPartProps) => {
    const classes: IBonusQuestionPartStyle = useStyle();
    const onChangeHandler = React.useCallback((ev, checked) => onCorrectChange(props, ev, checked), [props]);

    const disabledClassName = props.disabled ? "" : " disabled";
    const answerClassName = classes.bonusPartAnswer + disabledClassName;
    const questionTextClassName = classes.bonusPartQuestionText + disabledClassName;

    const isCorrect: boolean =
        (props.cycle.bonusAnswer?.correctParts.findIndex((part) => part.index === props.partNumber - 1) ?? -1) >= 0;

    const bonusPartText: IFormattedText[] = FormattedTextParser.parseFormattedText(props.bonusPart.question);

    return (
        <div className="bonus-part">
            <div className={questionTextClassName}>
                <Checkbox
                    disabled={!props.disabled}
                    checked={isCorrect}
                    ariaLabel={`Part ${props.partNumber}: ${isCorrect ? "Correct" : "Missed"}`}
                    onChange={onChangeHandler}
                />
                <span>
                    [{props.bonusPart.value}] <FormattedText segments={bonusPartText} />
                </span>
            </div>
            <div className={classes.bonusPartAnswerSpacer}>
                <Answer className={answerClassName} text={props.bonusPart.answer.trimLeft()} />
            </div>
        </div>
    );
});

function onCorrectChange(
    props: IBonusQuestionPartProps,
    ev?: React.FormEvent<HTMLElement | HTMLInputElement>,
    checked?: boolean
): void {
    const isCorrect: boolean = checked ?? false;
    props.cycle.setBonusPartAnswer(props.partNumber - 1, isCorrect, isCorrect ? props.bonusPart.value : 0);
}

// TODO: See if it makes sense to move disabled to UIState
export interface IBonusQuestionPartProps {
    bonusPart: IBonusPart;
    cycle: Cycle;
    disabled: boolean;
    partNumber: number;
    uiState: UIState;
}

interface IBonusQuestionPartStyle {
    bonusPartQuestionText: string;
    bonusPartAnswer: string;
    bonusPartAnswerSpacer: string;
}

const useStyle: (data?: unknown) => IBonusQuestionPartStyle = createUseStyles({
    bonusPartQuestionText: {
        display: "flex",
        marginTop: 5,
        "&.disabled": {
            color: "#888888",
        },
    },
    bonusPartAnswer: {
        "&.disabled": {
            color: "#888888",
        },
    },
    bonusPartAnswerSpacer: {
        padding: "0 24px",
    },
});
