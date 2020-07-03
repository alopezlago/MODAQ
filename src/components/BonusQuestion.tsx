import * as React from "react";
import { observer } from "mobx-react";
import { createUseStyles } from "react-jss";

import { BonusQuestionPart } from "./BonusQuestionPart";
import { Bonus } from "src/state/PacketState";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import { CancelButton } from "./CancelButton";
import { BonusProtestDialog } from "./BonusProtestDialog";

export const BonusQuestion = observer((props: IBonusQuestionProps) => {
    const classes: IBonusQuestionStyle = useStyle();
    const throwOutClickHandler: () => void = React.useCallback(() => {
        props.cycle.addThrownOutBonus(props.bonusIndex);
    }, [props]);

    const parts: JSX.Element[] = props.bonus.parts.map((bonusPartProps, index) => {
        return (
            <BonusQuestionPart
                key={index}
                bonusPart={bonusPartProps}
                cycle={props.cycle}
                partNumber={index + 1}
                uiState={props.uiState}
                disabled={props.inPlay}
            />
        );
    });

    const leadinClassName = classes.bonusLeadin + (props.inPlay ? "" : " disabled");
    return (
        <div className={classes.bonusContainer}>
            <BonusProtestDialog bonus={props.bonus} cycle={props.cycle} uiState={props.uiState} />
            <div className="bonus-question">
                <div className={leadinClassName}>{props.bonus.leadin}</div>
                {parts}
            </div>
            <div>
                <CancelButton disabled={!props.inPlay} title="Throw out bonus" onClick={throwOutClickHandler} />
            </div>
        </div>
    );
});

export interface IBonusQuestionProps {
    bonus: Bonus;
    bonusIndex: number;
    cycle: Cycle;
    uiState: UIState;
    inPlay: boolean;
}

interface IBonusQuestionStyle {
    bonusLeadin: string;
    bonusContainer: string;
}

const useStyle: (data?: unknown) => IBonusQuestionStyle = createUseStyles({
    bonusContainer: {
        display: "flex",
        justifyContent: "space-between",
    },
    bonusLeadin: {
        paddingLeft: "24px",
        "&.disabled": {
            color: "#888888",
        },
    },
});
