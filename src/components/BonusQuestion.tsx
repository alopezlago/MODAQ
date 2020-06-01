import * as React from "react";
import { observer } from "mobx-react";

import { BonusQuestionPart } from "./BonusQuestionPart";
import { Bonus } from "src/state/PacketState";
import { UIState } from "src/state/UIState";

@observer
export class BonusQuestion extends React.Component<IBonusQuestionProps> {
    public render(): JSX.Element {
        const parts: JSX.Element[] = this.props.bonus.parts.map((bonusPartProps, index) =>
            <BonusQuestionPart key={index} bonusPart={bonusPartProps} partNumber={index + 1} uiState={this.props.uiState} />);
        return (
            <div className="bonus-question">
                <div className="bonus-leadin">{this.props.bonus.leadin}</div>
                {parts}
            </div>
        );
    }
}

export interface IBonusQuestionProps {
    bonus: Bonus;
    uiState: UIState;
}
