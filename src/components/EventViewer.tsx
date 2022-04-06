import * as React from "react";
import { observer } from "mobx-react-lite";
import { DetailsList, CheckboxVisibility, SelectionMode, IColumn, Label, Text } from "@fluentui/react";
import { mergeStyleSets } from "@fluentui/react";

import { CycleItemList } from "./cycleItems/CycleItemList";
import { Cycle } from "src/state/Cycle";
import { AppState } from "src/state/AppState";
import { GameState } from "src/state/GameState";
import { StateContext } from "src/contexts/StateContext";

const numberKey = "number";
const cycleKey = "cycle";

export const EventViewer = observer(function EventViewer(): JSX.Element | null  {
    const appState: AppState = React.useContext(StateContext);
    const classes: IEventViewerClassNames = getClassNames(appState.uiState.isEventLogHidden);

    const activeItemChangedHandler = React.useCallback(
        (item: IEventViewerRow, index?: number) => {
            if (index != undefined) {
                appState.uiState.setCycleIndex(index);
            }
        },
        [appState.uiState]
    );

    const renderColumnHandler = React.useCallback(
        (item?: Cycle, index?: number, column?: IColumn): JSX.Element => {
            if (item === undefined || index === undefined || column === undefined) {
                return <></>;
            }

            return onRenderItemColumn(item, appState.game, index, column);
        },
        [appState]
    );

    const columns: IColumn[] = [
        {
            key: numberKey,
            fieldName: "number",
            name: "#",
            minWidth: 20,
            maxWidth: 40,
            ariaLabel: "Question number",
            isResizable: true,
            isRowHeader: true,
        },
        {
            key: cycleKey,
            fieldName: "cycle",
            name: "Events",
            minWidth: 80,
            isResizable: true,
            isMultiline: true,
            // We need to pass the scores in, instead of the game, since the callback won't be in a reactive context, so
            // the computed will be recalculated each time
            // TODO: Consider adding autoruns for scores/finalScore so we don't have to consider what context it's run
            // in. Just swapping scores with a scores2 value set during autorun didn't work initially, so it needs more
            // investigation.
            data: appState.game.scores.slice(0, appState.game.playableCycles.length),
        },
    ];

    return (
        <div className={classes.eventViewerContainer} data-is-scrollable="true">
            <DetailsList
                checkboxVisibility={CheckboxVisibility.hidden}
                selectionMode={SelectionMode.single}
                columns={columns}
                items={appState.game.playableCycles}
                onActiveItemChanged={activeItemChangedHandler}
                onRenderItemColumn={renderColumnHandler}
            />
        </div>
    );
});

function onRenderItemColumn(item: Cycle, game: GameState, index: number, column: IColumn): JSX.Element {
    switch (column?.key) {
        case numberKey:
            if (index == undefined) {
                return <></>;
            }

            return <Label>{index + 1}</Label>;
        case cycleKey:
            const scores: [number, number][] = column.data;
            const scoreInCurrentCycle: [number, number] = scores[index];

            return (
                <>
                    <CycleItemList cycle={item} game={game} />
                    <Text>{`(${scoreInCurrentCycle[0]} - ${scoreInCurrentCycle[1]})`}</Text>
                </>
            );
        default:
            return <></>;
    }
}

interface IEventViewerClassNames {
    eventViewerContainer: string;
}

interface IEventViewerRow {
    number: JSX.Element;
    cycle: JSX.Element;
}

const getClassNames = (isHidden: boolean): IEventViewerClassNames =>
    mergeStyleSets({
        eventViewerContainer: {
            border: "1px black solid",
            maxHeight: "90vh",
            overflowY: "auto",
            display: isHidden ? "none" : undefined,
        },
    });
