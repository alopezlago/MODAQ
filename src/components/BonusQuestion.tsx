import * as React from "react";
import { observer } from "mobx-react";
import { createUseStyles } from "react-jss";

import { BonusQuestionPart } from "./BonusQuestionPart";
import { Bonus } from "src/state/PacketState";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";

export const BonusQuestion = observer((props: IBonusQuestionProps) => {
    const classes: IBonusQuestionStyle = useStyle();
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
        <div className="bonus-question">
            <div className={leadinClassName}>{props.bonus.leadin}</div>
            {parts}
        </div>
    );
});

// TODO: Should have something for if bonus is in play?
export interface IBonusQuestionProps {
    bonus: Bonus;
    cycle: Cycle;
    uiState: UIState;
    inPlay: boolean;
}

interface IBonusQuestionStyle {
    bonusLeadin: string;
}

const useStyle: (data?: unknown) => IBonusQuestionStyle = createUseStyles({
    bonusLeadin: {
        padding: "0 24px",
        "&.disabled": {
            color: "#888888",
        },
    },
});
