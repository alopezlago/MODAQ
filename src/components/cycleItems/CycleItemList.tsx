import * as React from "react";
import { observer } from "mobx-react-lite";

import { Cycle } from "../../state/Cycle";
import {
    IThrowOutQuestionEvent,
    ITossupAnswerEvent,
    ISubstitutionEvent,
    IBonusProtestEvent,
    ITossupProtestEvent,
    IBonusAnswerEvent,
    IPlayerJoinsEvent,
    IPlayerLeavesEvent,
} from "../../state/Events";
import { PlayerLeavesCycleItem } from "./PlayerLeaveCycleItem";
import { PlayerJoinsCycleItem } from "./PlayerJoinsCycleItem";
import { SubstitutionCycleItem } from "./SubstitutionCycleItem";
import { TossupAnswerCycleItem } from "./TossupAnswerCycleItem";
import { ThrowOutQuestionCycleItem } from "./ThrowOutQuestionCycleItem";
import { BonusAnswerCycleItem } from "./BonusAnswerCycleItem";
import { TossupProtestCycleItem } from "./TossupProtestCycleItem";
import { BonusProtestCycleItem } from "./BonusProtestCycleItem";
import { GameState } from "../../state/GameState";

export const CycleItemList = observer(function CycleItemList(props: ICycleItemListProps): JSX.Element {
    return <div>{createCycleList(props.cycle, props.game)}</div>;
});

// TODO: Consider moving some of this logic to a separate class for testing; specifically ordering ones
// TODO: Investigate using List/DetailedList for this, instead of returning a bunch of individual elements
// Consider making CycleItem take in a "data" field, that can be passed into the click handler. This will solve the
// issue of making a new event handler each time
function createCycleList(cycle: Cycle, game: GameState): JSX.Element[] {
    // Ordering should be
    // Substitutions
    // Buzzes and thrown out tossups, based on the tossup index. If a thrown out tossup and buzz have the same index,
    // prefer the buzz.
    // Thrown out bonuses
    // Bonus Answer
    // TU protests
    // Bonus protests

    const elements: JSX.Element[] = [];

    if (cycle.playerLeaves) {
        for (let i = 0; i < cycle.playerLeaves.length; i++) {
            elements.push(createPlayerLeaveDetails(cycle, cycle.playerLeaves[i], i));
        }
    }

    if (cycle.playerJoins) {
        for (let i = 0; i < cycle.playerJoins.length; i++) {
            elements.push(createPlayerJoinDetails(cycle, cycle.playerJoins[i], i));
        }
    }

    if (cycle.subs) {
        for (let i = 0; i < cycle.subs.length; i++) {
            elements.push(createSubstitutionDetails(cycle, cycle.subs[i], i));
        }
    }

    const thrownOutTossups: IThrowOutQuestionEvent[] = cycle.thrownOutTossups ?? [];
    const lastThrownOutTossupIndex = thrownOutTossups.length - 1;

    // mobx will complain if we call sort on an observable array, so copy the elements before sorting it
    [...thrownOutTossups].sort((event, otherEvent) => event.questionIndex - otherEvent.questionIndex);
    const orderedBuzzes: ITossupAnswerEvent[] = cycle.orderedBuzzes;

    if (orderedBuzzes.length === 0) {
        for (let i = 0; i < thrownOutTossups.length; i++) {
            const isLastThrownOutTossup: boolean = i === lastThrownOutTossupIndex;
            elements.push(
                createThrowOutQuestionDetails(cycle, thrownOutTossups[i], i, /* isTossup */ true, isLastThrownOutTossup)
            );
        }
    } else {
        // We want buzzes on a specific question to appear before the event throwing out that question appears.
        // Because tossups can be thrown out before any buzzes or between an incorrect buzz and a correct buzz, we have
        // to loop through both buzzes and thrown out questions to display the events in order
        let currentTossupIndex: number = orderedBuzzes[0].tossupIndex;
        let thrownOutTossupsIndex = 0;
        for (let i = 0; i < orderedBuzzes.length; i++) {
            const buzz = orderedBuzzes[i];
            if (buzz.tossupIndex >= currentTossupIndex) {
                currentTossupIndex = buzz.tossupIndex;

                while (
                    thrownOutTossupsIndex < thrownOutTossups.length &&
                    thrownOutTossups[thrownOutTossupsIndex].questionIndex < currentTossupIndex
                ) {
                    const isLastThrownOutTossup: boolean = thrownOutTossupsIndex === lastThrownOutTossupIndex;
                    elements.push(
                        createThrowOutQuestionDetails(
                            cycle,
                            thrownOutTossups[thrownOutTossupsIndex],
                            thrownOutTossupsIndex,
                            /* isTossup */ true,
                            isLastThrownOutTossup
                        )
                    );
                    thrownOutTossupsIndex++;
                }
            }

            elements.push(createTossupAnswerDetails(cycle, buzz, game, i));
        }

        // Ordering is still a little off, and the buzzes remain in view. Tweak this.
        for (; thrownOutTossupsIndex < thrownOutTossups.length; thrownOutTossupsIndex++) {
            const isLastThrownOutTossup: boolean = thrownOutTossupsIndex === lastThrownOutTossupIndex;
            elements.push(
                createThrowOutQuestionDetails(
                    cycle,
                    thrownOutTossups[thrownOutTossupsIndex],
                    thrownOutTossupsIndex,
                    /* isTossup */ true,
                    isLastThrownOutTossup
                )
            );
        }
    }

    if (cycle.thrownOutBonuses) {
        const lastThrownOutBonusIndex: number = cycle.thrownOutBonuses.length - 1;
        for (let i = 0; i < cycle.thrownOutBonuses.length; i++) {
            const isLastThrownOutBonus: boolean = i === lastThrownOutBonusIndex;
            elements.push(
                createThrowOutQuestionDetails(
                    cycle,
                    cycle.thrownOutBonuses[i],
                    i,
                    /* isTossup */ false,
                    isLastThrownOutBonus
                )
            );
        }
    }

    if (cycle.bonusAnswer && cycle.correctBuzz) {
        elements.push(createBonusAnswerDetails(cycle.bonusAnswer, cycle.correctBuzz));
    }

    if (cycle.tossupProtests) {
        for (let i = 0; i < cycle.tossupProtests.length; i++) {
            elements.push(createTossupProtestDetails(cycle, cycle.tossupProtests[i], i));
        }
    }

    if (cycle.bonusProtests) {
        for (let i = 0; i < cycle.bonusProtests.length; i++) {
            elements.push(createBonusProtestDetails(cycle, cycle.bonusProtests[i], i));
        }
    }

    return elements;
}

function createPlayerLeaveDetails(cycle: Cycle, leave: IPlayerLeavesEvent, index: number): JSX.Element {
    return <PlayerLeavesCycleItem key={`sub_${index}_out_${leave.outPlayer?.name}`} cycle={cycle} leave={leave} />;
}

function createPlayerJoinDetails(cycle: Cycle, join: IPlayerJoinsEvent, index: number): JSX.Element {
    return <PlayerJoinsCycleItem key={`sub_${index}_in_${join.inPlayer.name}`} cycle={cycle} join={join} />;
}

function createSubstitutionDetails(cycle: Cycle, sub: ISubstitutionEvent, index: number): JSX.Element {
    return (
        <SubstitutionCycleItem
            key={`sub_${index}_${sub.inPlayer.name}_${sub.outPlayer?.name}`}
            cycle={cycle}
            sub={sub}
        />
    );
}

function createTossupAnswerDetails(
    cycle: Cycle,
    buzz: ITossupAnswerEvent,
    game: GameState,
    buzzIndex: number
): JSX.Element {
    // TODO: Look into using something like shortid for the key
    return (
        <TossupAnswerCycleItem
            key={`buzz_${buzzIndex}_tu_${buzz.tossupIndex}_${buzz.marker.player.name}_${buzz.marker.player.teamName}`}
            cycle={cycle}
            buzz={buzz}
            game={game}
        />
    );
}

function createThrowOutQuestionDetails(
    cycle: Cycle,
    thrownOutEvent: IThrowOutQuestionEvent,
    thrownOutIndex: number,
    isTossup: boolean,
    isLastThrownOutQuestion: boolean
): JSX.Element {
    return (
        <ThrowOutQuestionCycleItem
            key={`throw_out_${isTossup}_${thrownOutIndex}`}
            cycle={cycle}
            thrownOutEvent={thrownOutEvent}
            isTossup={isTossup}
            isLastThrownOutQuestion={isLastThrownOutQuestion}
        />
    );
}

function createBonusAnswerDetails(bonusAnswer: IBonusAnswerEvent, correctBuzz: ITossupAnswerEvent): JSX.Element {
    return <BonusAnswerCycleItem key="bonus_answer" bonusAnswer={bonusAnswer} correctBuzz={correctBuzz} />;
}

function createTossupProtestDetails(cycle: Cycle, protest: ITossupProtestEvent, protestIndex: number): JSX.Element {
    return (
        <TossupProtestCycleItem
            key={`tu_protest_${protestIndex}_${protest.questionIndex}`}
            cycle={cycle}
            protest={protest}
        />
    );
}

function createBonusProtestDetails(cycle: Cycle, protest: IBonusProtestEvent, protestIndex: number): JSX.Element {
    return (
        <BonusProtestCycleItem
            key={`bonus_protest_${protestIndex}_${protest.questionIndex}`}
            cycle={cycle}
            protest={protest}
        />
    );
}

interface ICycleItemListProps {
    cycle: Cycle;
    game: GameState;
}
