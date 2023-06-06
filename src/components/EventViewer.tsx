import * as React from "react";
import { observer } from "mobx-react-lite";
import { DetailsList, CheckboxVisibility, SelectionMode, IColumn, Label, Text, ISelection } from "@fluentui/react";
import { mergeStyleSets } from "@fluentui/react";

import { CycleItemList } from "./cycleItems/CycleItemList";
import { Cycle } from "../state/Cycle";
import { AppState } from "../state/AppState";
import { StateContext } from "../contexts/StateContext";

const numberKey = "number";
const cycleKey = "cycle";

// Needed for filling in dummy values into an interface
// eslint-disable-next-line @typescript-eslint/no-empty-function
function dummyFunction() {}

export const EventViewer = observer(function EventViewer(): JSX.Element | null {
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

            return onRenderItemColumn(item, appState, index, column);
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
            data: appState.uiState.cycleIndex,
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

    // DetailsList doesn't know how to change its selection when the cycle index changes unless we tell it how to select it
    const selection: ISelection = {
        count: 1,
        mode: SelectionMode.single,
        canSelectItem: () => true,
        setChangeEvents: dummyFunction,
        setItems: dummyFunction,
        getItems: () => [],
        getSelection: () => [{}],
        getSelectedIndices: () => [appState.uiState.cycleIndex],
        getSelectedCount: () => 1,
        isRangeSelected: (): boolean => false,
        isAllSelected: () => appState.uiState.cycleIndex === appState.game.playableCycles.length,
        isIndexSelected: (index) => index === appState.uiState.cycleIndex,
        isKeySelected: () => false,
        setAllSelected: dummyFunction,
        setKeySelected: dummyFunction,
        setIndexSelected: (index: number): void => appState.uiState.setCycleIndex(index),
        selectToKey: dummyFunction,
        selectToIndex: (index: number): void => appState.uiState.setCycleIndex(index),
        toggleAllSelected: dummyFunction,
        toggleKeySelected: dummyFunction,
        toggleIndexSelected: (index: number): void => {
            appState.uiState.setCycleIndex(index);
        },
        toggleRangeSelected: dummyFunction,
    };

    // This needs to re-render based on cycleIndex so it can select the current one
    return (
        <div className={classes.eventViewerContainer} data-is-scrollable="true">
            <DetailsList
                checkboxVisibility={CheckboxVisibility.hidden}
                selectionMode={SelectionMode.single}
                columns={columns}
                items={appState.game.playableCycles}
                onActiveItemChanged={activeItemChangedHandler}
                onRenderItemColumn={renderColumnHandler}
                selection={selection}
            />
        </div>
    );
});

function onRenderItemColumn(item: Cycle, appState: AppState, index: number, column: IColumn): JSX.Element {
    switch (column?.key) {
        case numberKey:
            if (index == undefined) {
                return <></>;
            }

            if (column?.data === index) {
                return (
                    <u>
                        <Label>{index + 1}</Label>
                    </u>
                );
            }

            return <Label>{index + 1}</Label>;
        case cycleKey:
            const scores: number[][] = column.data;
            const scoreInCurrentCycle: number[] = scores[index];

            return (
                <>
                    <CycleItemList cycle={item} game={appState.game} />
                    <Text>{`(${scoreInCurrentCycle.join(" - ")})`}</Text>
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
