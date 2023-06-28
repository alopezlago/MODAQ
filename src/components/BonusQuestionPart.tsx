import React from "react";
import {
    Checkbox,
    Dropdown,
    IDropdownOption,
    IDropdownStyles,
    ITheme,
    mergeStyleSets,
    ThemeContext,
} from "@fluentui/react";
import { observer } from "mobx-react-lite";

import * as PacketState from "../state/PacketState";
import { BonusPart } from "../state/PacketState";
import { Cycle } from "../state/Cycle";
import { Answer } from "./Answer";
import { FormattedText } from "./FormattedText";
import { IFormattedText } from "../parser/IFormattedText";
import { IGameFormat } from "../state/IGameFormat";
import { StateContext } from "../contexts/StateContext";
import { AppState } from "../state/AppState";

const bouncebackCorrectnessStyles: Partial<IDropdownStyles> = {
    root: {
        // We don't want the dropdown to push off the whole bonus part text, so show at least the first few letters
        // of the team name
        maxWidth: 100,
        marginRight: 5,
    },
};

export const BonusQuestionPart = observer(function BonusQuestionPart(props: IBonusQuestionPartProps) {
    const appState: AppState = React.useContext(StateContext);
    const onCheckboxChangeHandler = React.useCallback((ev, checked) => onCorrectChange(props, ev, checked), [props]);
    const onDropdownChangeHandler = React.useCallback((ev, option) => onTeamAnswerChange(props, ev, option), [props]);

    const highlightBackground = !appState.uiState.noBonusHighlight;
    const isCorrect: boolean = (props.cycle.bonusAnswer?.parts[props.partNumber - 1].points ?? 0) > 0;

    // TODO: Make more efficient. Right now O(n^2), but generally not bad because n is almost always 3
    // Looks for a correct part after this one to determine if this is incorrect, since we don't know if it is incorrect
    // or if they are still reading the part
    const isWrong: boolean =
        !isCorrect && props.cycle.bonusAnswer?.parts.slice(props.partNumber)?.some((part) => part.points > 0) === true;

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
        <ThemeContext.Consumer>
            {(theme) => {
                const classes: IBonusQuestionPartClassNames = getClassNames(
                    theme,
                    props.disabled,
                    isCorrect,
                    isWrong,
                    highlightBackground
                );

                return (
                    <div className={classes.bonusPartContainer}>
                        <div className={classes.bonusPartQuestionText}>
                            {correctnessMarker}
                            <span>
                                [{props.bonusPart.value}
                                {props.bonusPart.difficultyModifier}]{" "}
                                <FormattedText segments={bonusPartText} disabled={props.disabled} />
                            </span>
                        </div>
                        <div className={classes.bonusPartAnswerSpacer}>
                            <Answer
                                className={classes.bonusPartAnswer}
                                text={props.bonusPart.answer.trimStart()}
                                disabled={props.disabled}
                            />
                        </div>
                    </div>
                );
            }}
        </ThemeContext.Consumer>
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
    bonusPartContainer: string;
    bonusPartQuestionText: string;
    bonusPartAnswer: string;
    bonusPartAnswerSpacer: string;
}

const getClassNames = (
    theme: ITheme | undefined,
    disabled: boolean,
    isCorrect: boolean,
    isWrong: boolean,
    highlightBackground: boolean
): IBonusQuestionPartClassNames =>
    mergeStyleSets({
        bonusPartContainer: [
            highlightBackground &&
                isCorrect && {
                    background: theme ? theme.palette.tealLight + "20" : "rbg(0, 128, 128)",
                },
            highlightBackground &&
                isWrong && {
                    background: theme ? theme.palette.red + "20" : "rgb(128, 0, 0)",
                },
        ],
        bonusPartQuestionText: [
            { display: "flex", paddingTop: "1em" },
            disabled && {
                color: theme ? theme.palette.neutralSecondaryAlt : "#888888",
            },
        ],
        bonusPartAnswer: [
            disabled && {
                color: theme ? theme.palette.neutralSecondaryAlt : "#888888",
            },
        ],
        bonusPartAnswerSpacer: { padding: "0.25em 24px 0 24px" },
    });
