import * as React from "react";
import { observer } from "mobx-react-lite";
import { FocusZone, FocusZoneDirection, mergeStyleSets, Stack, StackItem } from "@fluentui/react";

import * as PacketState from "../state/PacketState";
import { BonusQuestionPart } from "./BonusQuestionPart";
import { Bonus } from "../state/PacketState";
import { Cycle } from "../state/Cycle";
import { CancelButton, ICancelButtonPrompt } from "./CancelButton";
import { BonusProtestDialog } from "./dialogs/BonusProtestDialog";
import { AppState } from "../state/AppState";
import { FormattedText } from "./FormattedText";
import { IFormattedText } from "../parser/IFormattedText";
import { PostQuestionMetadata } from "./PostQuestionMetadata";

const throwOutQuestionPrompt: ICancelButtonPrompt = {
    title: "Throw out Bonus",
    message: "Click OK to throw out the bonus. To undo this, click on the X next to its event in the Event Log.",
};

export const BonusQuestion = observer(function BonusQuestion(props: IBonusQuestionProps) {
    const classes: IBonusQuestionClassNames = getClassNames(!props.inPlay);
    const throwOutClickHandler: () => void = React.useCallback(() => {
        props.cycle.addThrownOutBonus(props.bonusIndex);
    }, [props]);
    const formattedLeadin: IFormattedText[] = React.useMemo(
        () => PacketState.getBonusWords(props.bonus.leadin, props.appState.game.gameFormat),
        [props.bonus.leadin, props.appState.game.gameFormat]
    );

    const parts: JSX.Element[] = props.bonus.parts.map((bonusPartProps, index) => {
        return (
            <BonusQuestionPart
                key={index}
                bonusPart={bonusPartProps}
                cycle={props.cycle}
                gameFormat={props.appState.game.gameFormat}
                partNumber={index + 1}
                teamNames={props.appState.game.teamNames}
                disabled={!props.inPlay}
            />
        );
    });

    const metadata: JSX.Element | undefined = props.bonus.metadata ? (
        <div className={classes.bonusMetadata}>
            <PostQuestionMetadata metadata={props.bonus.metadata} />
        </div>
    ) : undefined;

    return (
        <div className={classes.bonusContainer}>
            <BonusProtestDialog appState={props.appState} bonus={props.bonus} cycle={props.cycle} />
            <Stack horizontal={true}>
                <StackItem className={classes.bonusText}>
                    <FocusZone as="div" shouldRaiseClicks={true} direction={FocusZoneDirection.vertical}>
                        <FormattedText className={classes.bonusLeadin} segments={formattedLeadin} />
                        {parts}
                        {metadata}
                    </FocusZone>
                </StackItem>
                <StackItem>
                    <div className={classes.bonusText}></div>
                </StackItem>
                <StackItem>
                    <CancelButton
                        disabled={!props.inPlay}
                        prompt={throwOutQuestionPrompt}
                        tooltip="Throw out bonus"
                        onClick={throwOutClickHandler}
                    />
                </StackItem>
            </Stack>
        </div>
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
    bonusText: string;
}

const getClassNames = (disabled?: boolean): IBonusQuestionClassNames =>
    mergeStyleSets({
        bonusContainer: {
            display: "flex",
            justifyContent: "space-between",
        },
        bonusLeadin: [
            { paddingLeft: "24px", display: "inline-block" },
            disabled && {
                color: "#888888",
            },
        ],
        bonusMetadata: {
            paddingLeft: 24,
            marginTop: "-1em",
        },
        bonusText: {
            maxHeight: "37.5vh",
            overflowY: "auto",
        },
    });
