import React from "react";
import { Checkbox, Dropdown, IDropdownOption, IDropdownStyles, mergeStyleSets } from "@fluentui/react";
import { observer } from "mobx-react-lite";

import * as PacketState from "src/state/PacketState";
import { BonusPart } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";
import { Answer } from "./Answer";
import { FormattedText } from "./FormattedText";
import { IFormattedText } from "src/parser/IFormattedText";
import { IGameFormat } from "src/state/IGameFormat";

const bouncebackCorrectnessStyles: Partial<IDropdownStyles> = {
    root: {
        // We don't want the dropdown to push off the whole bonus part text, so show at least the first few letters
        // of the team name
        maxWidth: 100,
        marginRight: 5,
    },
};

export const BonusQuestionPart = observer(function BonusQuestionPart(props: IBonusQuestionPartProps)  {
    const classes: IBonusQuestionPartClassNames = getClassNames(props.disabled);
    const onCheckboxChangeHandler = React.useCallback((ev, checked) => onCorrectChange(props, ev, checked), [props]);
    const onDropdownChangeHandler = React.useCallback((ev, option) => onTeamAnswerChange(props, ev, option), [props]);

    const isCorrect: boolean = (props.cycle.bonusAnswer?.parts[props.partNumber - 1].points ?? 0) > 0;

    let correctnessMarker: React.ReactElement | undefined = undefined;
    if (props.gameFormat.bonusesBounceBack) {
        // Need to see if the bonus answer team name matches the correct buzz
        const partTeamName: string = props.cycle.bonusAnswer?.parts[props.partNumber - 1].teamName ?? "";
        const options: IDropdownOption[] = [
            {
                key: "",
                text: "",
                selected: partTeamName === "",
            },
        ].concat(
            props.teamNames.map((teamName, index) => {
                return {
                    key: teamName,
                    text: `${index + 1}. ${teamName}`,
                    selected: partTeamName === teamName,
                };
            })
        );

        correctnessMarker = (
            <Dropdown
                disabled={props.disabled}
                options={options}
                onChange={onDropdownChangeHandler}
                selectedKey={partTeamName}
                styles={bouncebackCorrectnessStyles}
            />
        );
    } else {
        correctnessMarker = (
            <Checkbox
                disabled={props.disabled}
                checked={isCorrect}
                ariaLabel={`Part ${props.partNumber}: ${isCorrect ? "Correct" : "Missed"}`}
                onChange={onCheckboxChangeHandler}
            />
        );
    }

    const bonusPartText: IFormattedText[] = React.useMemo(
        () => PacketState.getBonusWords(props.bonusPart.question, props.gameFormat),
        [props.bonusPart.question, props.gameFormat]
    );

    // TODO: We should try to resize the checkbox's box to match the font size
    return (
        <div>
            <div className={classes.bonusPartQuestionText}>
                {correctnessMarker}
                <span>
                    [{props.bonusPart.value}
                    {props.bonusPart.difficultyModifier}] <FormattedText segments={bonusPartText} />
                </span>
            </div>
            <div className={classes.bonusPartAnswerSpacer}>
                <Answer className={classes.bonusPartAnswer} text={props.bonusPart.answer.trimLeft()} />
            </div>
        </div>
    );
});

function onCorrectChange(
    props: IBonusQuestionPartProps,
    ev?: React.FormEvent<HTMLElement | HTMLInputElement>,
    checked?: boolean
): void {
    if (props.cycle.correctBuzz == undefined) {
        return;
    }

    const isCorrect: boolean = checked ?? false;

    // If bouncebacks aren't supported, use the correct buzzer's team
    const teamName: string = props.cycle.correctBuzz.marker.player.teamName;
    props.cycle.setBonusPartAnswer(props.partNumber - 1, teamName, isCorrect ? props.bonusPart.value : 0);
}

function onTeamAnswerChange(
    props: IBonusQuestionPartProps,
    ev?: React.FormEvent<HTMLElement | HTMLDivElement>,
    option?: IDropdownOption
): void {
    if (
        props.cycle.correctBuzz == undefined ||
        option == undefined ||
        option.key == undefined ||
        typeof option.key !== "string"
    ) {
        return;
    }

    props.cycle.setBonusPartAnswer(props.partNumber - 1, option.key, option.key === "" ? 0 : props.bonusPart.value);
}

// TODO: See if it makes sense to move disabled to UIState
export interface IBonusQuestionPartProps {
    bonusPart: BonusPart;
    cycle: Cycle;
    disabled: boolean;
    gameFormat: IGameFormat;
    partNumber: number;
    teamNames: string[];
}

interface IBonusQuestionPartClassNames {
    bonusPartQuestionText: string;
    bonusPartAnswer: string;
    bonusPartAnswerSpacer: string;
}

const getClassNames = (disabled: boolean): IBonusQuestionPartClassNames =>
    mergeStyleSets({
        bonusPartQuestionText: [
            { display: "flex", marginTop: "1em" },
            disabled && {
                color: "#888888",
            },
        ],
        bonusPartAnswer: [
            disabled && {
                color: "#888888",
            },
        ],
        bonusPartAnswerSpacer: {
            padding: "0 24px",
            margin: "0.25em 0 1em 0",
        },
    });
