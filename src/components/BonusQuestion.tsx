import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets } from "@fluentui/react";

import * as FormattedTextParser from "src/parser/FormattedTextParser";
import { BonusQuestionPart } from "./BonusQuestionPart";
import { Bonus } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";
import { CancelButton } from "./CancelButton";
import { BonusProtestDialog } from "./dialogs/BonusProtestDialog";
import { AppState } from "src/state/AppState";
import { FormattedText } from "./FormattedText";
import { IFormattedText } from "src/parser/IFormattedText";

export const BonusQuestion = observer((props: IBonusQuestionProps) => {
    const classes: IBonusQuestionClassNames = getClassNames(!props.inPlay);
    const throwOutClickHandler: () => void = React.useCallback(() => {
        props.cycle.addThrownOutBonus(props.bonusIndex);
    }, [props]);
    const formattedLeadin: IFormattedText[] = FormattedTextParser.parseFormattedText(props.bonus.leadin.trim());

    const parts: JSX.Element[] = props.bonus.parts.map((bonusPartProps, index) => {
        return (
            <BonusQuestionPart
                key={index}
                bonusPart={bonusPartProps}
                cycle={props.cycle}
                partNumber={index + 1}
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
                <CancelButton disabled={!props.inPlay} title="Throw out bonus" onClick={throwOutClickHandler} />
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
