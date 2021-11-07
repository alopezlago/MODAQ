import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets } from "@fluentui/react";

import * as PacketState from "../state/PacketState";
import { BonusQuestionPart } from "./BonusQuestionPart";
import { Bonus } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";
import { CancelButton, ICancelButtonPrompt } from "./CancelButton";
import { BonusProtestDialog } from "./dialogs/BonusProtestDialog";
import { AppState } from "src/state/AppState";
import { FormattedText } from "./FormattedText";
import { IFormattedText } from "src/parser/IFormattedText";

const throwOutQuestionPrompt: ICancelButtonPrompt = {
    title: "Throw out Bonus",
    message: "Click OK to throw out the bonus. To undo this, click on the X next to its event in the Event Log.",
};

export const BonusQuestion = observer((props: IBonusQuestionProps) => {
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

    return (
        <div className={classes.bonusContainer}>
            <BonusProtestDialog appState={props.appState} bonus={props.bonus} cycle={props.cycle} />
            <div className={classes.bonusText}>
                <FormattedText className={classes.bonusLeadin} segments={formattedLeadin} />
                {parts}
            </div>
            <div>
                <CancelButton
                    disabled={!props.inPlay}
                    prompt={throwOutQuestionPrompt}
                    tooltip="Throw out bonus"
                    onClick={throwOutClickHandler}
                />
            </div>
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
        bonusText: {
            maxHeight: "37.5vh",
            overflowY: "auto",
        },
    });
