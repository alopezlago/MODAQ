import * as React from "react";
import { observer } from "mobx-react";
import { DetailsList, CheckboxVisibility, SelectionMode, IColumn } from "@fluentui/react/lib/DetailsList";
import { Label } from "@fluentui/react/lib/Label";
import { GameState } from "src/state/GameState";
import { UIState } from "src/state/UIState";
import { createUseStyles } from "react-jss";

import { CycleItemList } from "./CycleItemList";
import { Cycle } from "src/state/Cycle";

const numberKey = "number";
const cycleKey = "cycle";

// This should look like a numbered list, with the number representing the cycle.
const columns: IColumn[] = [
    {
        key: numberKey,
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
        key: cycleKey,
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

    const renderColumnHandler = React.useCallback((item?: Cycle, index?: number, column?: IColumn): JSX.Element => {
        if (item === undefined || index === undefined || column === undefined) {
            return <></>;
        }

        return onRenderItemColumn(item, index, column);
    }, []);

    return (
        <div className={classes.eventViewerContainer} data-is-scrollable="true">
            <DetailsList
                checkboxVisibility={CheckboxVisibility.hidden}
                selectionMode={SelectionMode.single}
                columns={columns}
                items={props.game.cycles}
                onActiveItemChanged={activeItemChangedHandler}
                onRenderItemColumn={renderColumnHandler}
            />
        </div>
    );
});

function onRenderItemColumn(item: Cycle, index: number, column: IColumn): JSX.Element {
    switch (column?.key) {
        case numberKey:
            if (index == undefined) {
                return <></>;
            }

            return <Label>{index + 1}</Label>;
        case cycleKey:
            return <CycleItemList cycle={item} />;
        default:
            return <></>;
    }
}

export interface IEventViewerProps {
    game: GameState;
    uiState: UIState;
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
        maxHeight: "80vh",
        overflowY: "auto",
    },
});
