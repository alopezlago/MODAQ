import React from "react";
import { observer } from "mobx-react";

import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";
import { TossupQuestion } from "./TossupQuestion";
import { Tossup } from "src/state/PacketState";
import { BonusQuestion } from "./BonusQuestion";

@observer
export class QuestionViewer extends React.Component<IQuestionViewerProps> {
    public render(): JSX.Element {
        const tossupIndex: number = this.getTossupIndex();
        if (tossupIndex > this.props.game.packet.tossups.length) {
            return <div>New tossups needed (past the end of the packet)</div>
        }

        const tossup: Tossup = this.props.game.packet.tossups[tossupIndex];

        const bonusIndex: number = this.getBonusIndex();
        let bonus: JSX.Element | null = null;
        if (bonusIndex < this.props.game.packet.bonsues.length) {
            bonus = <BonusQuestion bonus={this.props.game.packet.bonsues[bonusIndex]} uiState={this.props.uiState} />;
        }

        // TODO: Add bonus view below
        return <div className="question-view">
            <TossupQuestion tossupNumber={tossupIndex + 1} tossup={tossup} uiState={this.props.uiState} />
            {bonus}
        </div>;
    }

    private getBonusIndex = (): number => {
        const usedBonusesCount = this.props.game.cycles.reduce<number>((usedBonuses, value) => {
            if (value.correctBuzz != undefined) {
                return usedBonuses + 1;
            }

            if (value.thrownOutBonuses == undefined) {
                return usedBonuses;
            }

            return value.thrownOutBonuses
                .map(event => event.questionIndex)
                .filter(index => index < this.props.uiState.cycleIndex)
                .length;
        }, 0);

        // TODO: Limit this to bonuses.length?
        return this.props.uiState.cycleIndex + usedBonusesCount;
    }

    // TODO: This value could be computed somewhere, so the cycle <-> TU index and bonus index can be cached
    private getTossupIndex = (): number => {
        const thrownOutTossupsCount = this.props.game.cycles.reduce<number>((thrownOutCount, value) => {
            if (value.thrownOutTossups == undefined) {
                return thrownOutCount;
            }

            return thrownOutCount + value.thrownOutTossups
                .map(event => event.questionIndex)
                .filter(index => index < this.props.uiState.cycleIndex)
                .length;
        }, 0);

        return this.props.uiState.cycleIndex + thrownOutTossupsCount;
    }
}

export interface IQuestionViewerProps {
    game: GameState;
    uiState: UIState;
}