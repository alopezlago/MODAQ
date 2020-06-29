import * as React from "react";
import { observer } from "mobx-react";
import { DetailsList, CheckboxVisibility, SelectionMode, IColumn } from "office-ui-fabric-react/lib/DetailsList";
import { Label } from "office-ui-fabric-react/lib/Label";
import { GameState } from "src/state/GameState";
import { UIState } from "src/state/UIState";
import { createUseStyles } from "react-jss";
import { CycleItemList } from "./CycleItemList";

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
            cycle: <CycleItemList key={`cycle_${index}`} cycle={cycle} />,
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
        overflowY: "auto",
    },
});
