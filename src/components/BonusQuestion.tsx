import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    FocusZone,
    FocusZoneDirection,
    IStackStyles,
    ITheme,
    mergeStyleSets,
    Stack,
    StackItem,
    ThemeContext,
} from "@fluentui/react";

import * as BonusQuestionController from "./BonusQuestionController";
import * as PacketState from "../state/PacketState";
import { BonusQuestionPart } from "./BonusQuestionPart";
import { Bonus } from "../state/PacketState";
import { Cycle } from "../state/Cycle";
import { CancelButton } from "./CancelButton";
import { BonusProtestDialog } from "./dialogs/BonusProtestDialog";
import { AppState } from "../state/AppState";
import { FormattedText } from "./FormattedText";
import { IFormattedText } from "../parser/IFormattedText";
import { PostQuestionMetadata } from "./PostQuestionMetadata";

let bonusQuestionTextIdCounter = 0;

export const BonusQuestion = observer(function BonusQuestion(props: IBonusQuestionProps) {
    const throwOutClickHandler: () => void = React.useCallback(() => {
        BonusQuestionController.throwOutBonus(props.cycle, props.bonusIndex);
    }, [props]);
    const formattedLeadin: IFormattedText[] = React.useMemo(
        () =>
            PacketState.getBonusWords(`${props.bonusIndex + 1}. ${props.bonus.leadin}`, props.appState.game.gameFormat),
        [props.bonusIndex, props.bonus.leadin, props.appState.game.gameFormat]
    );
    const [lastBonus, setLastBonus] = React.useState(props.bonus);

    // Unfortunately StackItems reset the font, so we have to override the font there
    const fontSize: number = props.appState.uiState.questionFontSize;
    const fontFamily: string = props.appState.uiState.fontFamily;
    const stackItemStyles: IStackStyles = {
        root: {
            fontFamily,
            fontSize,
        },
    };

    // Set the ID and bump it up for the next item
    const [bonusId] = React.useState(bonusQuestionTextIdCounter);
    React.useEffect(() => {
        bonusQuestionTextIdCounter++;
    }, []);

    const bonusQuestionTextId = `bonusQuestionText${bonusId}`;

    const hasBonusChanged = lastBonus !== props.bonus;
    if (hasBonusChanged) {
        setLastBonus(props.bonus);

        // Because the bonus text has the scrollbar, and StackItem doesn't have a ref field, we have to get it manually
        // from the DOM. We can't use a class name because it keeps changing, so we have to use an ID.
        const bonusText: HTMLElement | null = document.getElementById(bonusQuestionTextId);
        if (bonusText != null) {
            bonusText.scrollTop = 0;
        }
    }

    const disabled = !props.inPlay;
    const disableThrowOutButton: boolean =
        disabled ||
        props.appState.game.cycles.some(
            (cycle) => cycle.bonusAnswer != undefined && cycle.bonusAnswer.bonusIndex > props.bonusIndex
        );
    const throwOutButtonTooltip: string =
        disableThrowOutButton && !disabled ? "Cannot throw out bonus if future bonuses have events" : "Throw out bonus";

    const parts: JSX.Element[] = props.bonus.parts.map((bonusPartProps, index) => {
        return (
            <BonusQuestionPart
                key={index}
                bonusPart={bonusPartProps}
                cycle={props.cycle}
                gameFormat={props.appState.game.gameFormat}
                partNumber={index + 1}
                teamNames={props.appState.game.teamNames}
                disabled={disabled}
            />
        );
    });

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const fontSize: number = props.appState.uiState.questionFontSize;
                const classes: IBonusQuestionClassNames = getClassNames(theme, fontSize, !props.inPlay);

                const metadata: JSX.Element | undefined = props.bonus.metadata ? (
                    <div className={classes.bonusMetadata}>
                        <PostQuestionMetadata metadata={props.bonus.metadata} />
                    </div>
                ) : undefined;

                return (
                    <div className={classes.bonusContainer}>
                        <BonusProtestDialog appState={props.appState} bonus={props.bonus} cycle={props.cycle} />
                        <Stack horizontal={true}>
                            <StackItem id={bonusQuestionTextId} styles={stackItemStyles}>
                                <FocusZone as="div" shouldRaiseClicks={true} direction={FocusZoneDirection.vertical}>
                                    <FormattedText
                                        className={classes.bonusLeadin}
                                        segments={formattedLeadin}
                                        disabled={disabled}
                                    />
                                    {parts}
                                    {metadata}
                                </FocusZone>
                            </StackItem>
                            <StackItem styles={stackItemStyles}>
                                <div />
                            </StackItem>
                            <StackItem>
                                <CancelButton
                                    disabled={disableThrowOutButton}
                                    tooltip={throwOutButtonTooltip}
                                    onClick={throwOutClickHandler}
                                />
                            </StackItem>
                        </Stack>
                    </div>
                );
            }}
        </ThemeContext.Consumer>
    );
});

export interface IBonusQuestionProps {
    appState: AppState;
    bonus: Bonus;
    bonusIndex: number;
    cycle: Cycle;
    inPlay: boolean;
}

interface IBonusQuestionClassNames {
    bonusLeadin: string;
    bonusContainer: string;
    bonusMetadata: string;
}

const getClassNames = (theme: ITheme | undefined, fontSize: number, disabled: boolean): IBonusQuestionClassNames =>
    mergeStyleSets({
        bonusContainer: {
            display: "flex",
            justifyContent: "space-between",
        },
        bonusLeadin: [
            { paddingLeft: "24px", display: "inline-block", fontSize },
            disabled && {
                color: theme ? theme.palette.neutralSecondaryAlt : "#888888",
            },
        ],
        bonusMetadata: [
            {
                paddingLeft: 24,
            },
            disabled && {
                color: theme ? theme.palette.neutralSecondaryAlt : "#888888",
            },
        ],
    });
