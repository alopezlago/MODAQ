import * as React from "react";
import { observer } from "mobx-react";
import { DetailsList, CheckboxVisibility, SelectionMode, IColumn } from "office-ui-fabric-react/lib/DetailsList";
import { Label } from "office-ui-fabric-react/lib/Label";
import { GameState } from "src/state/GameState";
import { UIState } from "src/state/UIState";
import { createUseStyles } from "react-jss";
import { Cycle } from "src/state/Cycle";
import {
    ISubstitutionEvent,
    IThrowOutQuestionEvent,
    ITossupAnswerEvent,
    IBonusAnswerEvent,
    ITossupProtestEvent,
    IBonusProtestEvent,
} from "src/state/Events";

// This should look like a numbered list, with the number representing the cycle.

const columns: IColumn[] = [
    {
        key: "number",
        fieldName: "number",
        name: "#",
        minWidth: 20,
        maxWidth: 40,
        ariaLabel: "Question number",
        data: "number",
        isResizable: true,
        isRowHeader: true,
    },
    {
        key: "cycle",
        fieldName: "cycle",
        name: "Events",
        minWidth: 80,
        isResizable: true,
        isMultiline: true,
    },
];

export const EventViewer = observer((props: IEventViewerProps): JSX.Element | null => {
    const classes: IEventViewerStyle = useStyle();

    const activeItemChangedHandler = React.useCallback(
        (item: IEventViewerRow, index?: number) => {
            if (index != undefined) {
                props.uiState.setCycleIndex(index);
            }
        },
        [props]
    );

    const items: IEventViewerRow[] = props.game.cycles.map((cycle, index) => {
        return {
            cycle: <CycleItem key={`cycle_${index}`} cycle={cycle} />,
            number: <Label key={`number_${index}`}>{index + 1}</Label>,
        };
    });

    return (
        <div className={classes.eventViewerContainer} data-is-scrollable="true">
            <DetailsList
                checkboxVisibility={CheckboxVisibility.hidden}
                selectionMode={SelectionMode.single}
                columns={columns}
                items={items}
                onActiveItemChanged={activeItemChangedHandler}
            />
        </div>
    );
});

// TODO: Return another list, with elements we can delete. Can either try using another DetailedList, or a List.
// TODO: Consider moving this to another class, since there's a lot of rendering logic
const CycleItem = observer(
    (props: ICycleItemProps): JSX.Element => {
        return <div>{createCycleList(props.cycle)}</div>;
    }
);

// TODO: Consider moving some of this logic to a separate class for testing; specifically ordering ones
// TODO: Allow the user to 'X' out of events, which should remove them (and related events). This will require passing
// in the cycle to the helper methods.
function createCycleList(cycle: Cycle): JSX.Element[] {
    // Ordering should be
    // Substitutions
    // Buzzes and thrown out tossups, based on the tossup index. If a thrown out tossup and buzz have the same index,
    // prefer the buzz.
    // Thrown out bonuses
    // Bonus Answer
    // TU protests
    // Bonus protests
    const elements: JSX.Element[] = [];

    if (cycle.subs) {
        elements.concat(createSubstitutionDetails(cycle.subs));
    }

    const thrownOutTossups: IThrowOutQuestionEvent[] = cycle.thrownOutTossups ?? [];
    thrownOutTossups.sort((event, otherEvent) => event.questionIndex - otherEvent.questionIndex);
    const orderedBuzzes: ITossupAnswerEvent[] = cycle.orderedBuzzes;

    if (orderedBuzzes.length === 0) {
        // Just render thrown out tossups
    } else {
        let currentTossupIndex: number = orderedBuzzes[0].tossupIndex;
        let thrownOutTossupsIndex = 0;
        for (let i = 0; i < orderedBuzzes.length; i++) {
            const buzz = orderedBuzzes[i];
            if (buzz.tossupIndex > currentTossupIndex) {
                currentTossupIndex = buzz.tossupIndex;

                while (
                    thrownOutTossupsIndex < thrownOutTossups.length &&
                    thrownOutTossups[thrownOutTossupsIndex].questionIndex < currentTossupIndex
                ) {
                    elements.push(
                        createThrowOutQuestionDetails(
                            thrownOutTossups[thrownOutTossupsIndex],
                            thrownOutTossupsIndex,
                            /* isTossup */ true
                        )
                    );
                    thrownOutTossupsIndex++;
                }
            }

            elements.push(createTossupAnswerDetails(buzz, i));
        }
    }

    if (cycle.thrownOutBonuses) {
        for (let i = 0; i < cycle.thrownOutBonuses.length; i++) {
            elements.push(createThrowOutQuestionDetails(cycle.thrownOutBonuses[i], i, /* isTossup */ false));
        }
    }

    if (cycle.bonusAnswer) {
        elements.push(createBonusAnswerDetails(cycle.bonusAnswer));
    }

    if (cycle.tossupProtests) {
        for (let i = 0; i < cycle.tossupProtests.length; i++) {
            elements.push(createTossupProtestDetails(cycle.tossupProtests[i], i));
        }
    }

    if (cycle.bonusProtests) {
        for (let i = 0; i < cycle.bonusProtests.length; i++) {
            elements.push(createBonusProtestDetails(cycle.bonusProtests[i], i));
        }
    }

    return elements;
}

function createSubstitutionDetails(subs: ISubstitutionEvent[]): JSX.Element[] {
    return subs.map((sub, index) => {
        return (
            <Label key={`sub_${index}_${sub.inPlayer.name}_${sub.outPlayer.name}`}>
                Substitution ({sub.inPlayer.team.name}): {sub.inPlayer.name} in for {sub.outPlayer.name}
            </Label>
        );
    });
}

function createTossupAnswerDetails(buzz: ITossupAnswerEvent, buzzIndex: number): JSX.Element {
    // TODO: Look into using something like shortid for the key
    return (
        <Label
            key={`buzz_${buzzIndex}_tu_${buzz.tossupIndex}_${buzz.marker.player.name}_${buzz.marker.player.team.name}`}
        >
            {buzz.marker.player.name} ({buzz.marker.player.team.name}) answered{" "}
            {buzz.marker.correct ? "CORRECTLY" : "WRONGLY"} on tossup #{buzz.tossupIndex + 1} at word{" "}
            {buzz.marker.position + 1}
        </Label>
    );
}

function createThrowOutQuestionDetails(
    thrownOutEvent: IThrowOutQuestionEvent,
    thrownOutIndex: number,
    isTossup: boolean
): JSX.Element {
    const questionType: string = isTossup ? "tossup" : "bonus";

    return (
        <Label key={`throw_out_${questionType}_${thrownOutIndex}`}>
            Threw out {questionType} #{thrownOutEvent.questionIndex + 1}
        </Label>
    );
}

function createBonusAnswerDetails(bonusAnswer: IBonusAnswerEvent): JSX.Element {
    const parts: string = bonusAnswer.correctParts
        .map((part) => part.index + 1)
        .sort()
        .join(", ");
    const partsText: string = parts.length === 0 ? "no parts" : `part${parts.length > 1 ? "s" : ""} ${parts}`;
    const total: number = bonusAnswer.correctParts.reduce((previous, current) => previous + current.points, 0);

    return (
        <Label key="bonus_answer">
            {bonusAnswer.receivingTeam.name} answered {partsText} correctly for {total} points
        </Label>
    );
}

function createTossupProtestDetails(protest: ITossupProtestEvent, protestIndex: number): JSX.Element {
    // TODO: Should we include the description?
    return (
        <Label key={`tu_protest_${protestIndex}_${protest.questionIndex}`}>
            {protest.team.name} protests tossup #{protest.questionIndex + 1} at word {protest.position + 1}
        </Label>
    );
}

function createBonusProtestDetails(protest: IBonusProtestEvent, protestIndex: number): JSX.Element {
    // TODO: Should we include the description?
    return (
        <Label key={`bonus_protest_${protestIndex}_${protest.questionIndex}`}>
            {protest.team.name} protests bonus #{protest.questionIndex + 1}, part {protest.part + 1}
        </Label>
    );
}

export interface IEventViewerProps {
    game: GameState;
    uiState: UIState;
}

interface ICycleItemProps {
    cycle: Cycle;
}

interface IEventViewerStyle {
    eventViewerContainer: string;
}

interface IEventViewerRow {
    number: JSX.Element;
    cycle: JSX.Element;
}

const useStyle: (data?: unknown) => IEventViewerStyle = createUseStyles({
    eventViewerContainer: {
        border: "1px black solid",
        overflowY: "auto",
    },
});
