// List of players that can be re-organized through drag+drop
import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    IStackTokens,
    IColumn,
    IIconProps,
    IDragDropEvents,
    IconButton,
    Stack,
    StackItem,
    CheckboxVisibility,
    DetailsList,
    SelectionMode,
    IStackStyles,
} from "@fluentui/react";

import { Player } from "../state/TeamState";
import { PlayerEntry } from "./PlayerEntry";

const buttonTokens: IStackTokens = { childrenGap: 10 };

const playerEntryStyle: IStackStyles = {
    root: {
        flexGrow: 1,
        paddingRight: 10,
    },
};

const columns: IColumn[] = [
    {
        key: "name",
        fieldName: "name",
        name: "name",
        minWidth: 30,
    },
];

const downButtonProps: IIconProps = {
    iconName: "ChevronDown",
};

const upButtonProps: IIconProps = {
    iconName: "ChevronUp",
};

const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
};

const moveDownClassName = "moveDownButton";
const moveUpClassName = "moveUpButton";

// Accessibility issue: can't tab/move to the checkbox; it's taken over by the buttons
export const PlayerRoster = observer(function PlayerRoster(props: IPlayerRosterProps): JSX.Element {
    const [draggedItem, setDraggedItem] = React.useState<Player | undefined>(undefined);
    const [autoFocusIndex, setAutoFocusIndex] = React.useState<number | undefined>(undefined);
    const [autoFocusIsUp, setAutoFocusIsUp] = React.useState<boolean>(false);
    const [teamName, setTeamName] = React.useState<string | undefined>(undefined);

    // Need to reset auto-focus if the team changes
    React.useEffect(() => {
        if (props.players.length > 0 && props.players[0].teamName !== teamName) {
            setTeamName(props.players[0].teamName);
            setAutoFocusIndex(undefined);
        }
    }, [props.players, setTeamName, setAutoFocusIndex, teamName]);

    React.useEffect(() => {
        // This makes sure that the focus stays on the button belonging to the player
        if (autoFocusIndex != undefined) {
            const className: string = autoFocusIsUp ? moveUpClassName : moveDownClassName;
            const element = document.getElementsByClassName(className)[autoFocusIndex] as HTMLButtonElement;
            if (element) {
                element.focus();
            }

            setAutoFocusIndex(undefined);
        }
    }, [autoFocusIndex, autoFocusIsUp, props.players, setAutoFocusIndex]);

    function renderPlayerRow(player: Player | undefined, index: number | undefined) {
        if (player == undefined || index == undefined) {
            return <></>;
        }

        return (
            <div style={rowStyle}>
                <StackItem styles={playerEntryStyle}>
                    <PlayerEntry player={player} isNameReadonly={true} canSetStarter={props.canSetStarter}>
                        <Stack horizontal={true} tokens={buttonTokens}>
                            <StackItem>
                                <IconButton
                                    className={moveUpClassName}
                                    iconProps={upButtonProps}
                                    disabled={index === 0}
                                    onClick={() => {
                                        props.onMovePlayerForward(player);
                                        if (index > 1) {
                                            setAutoFocusIsUp(true);
                                            setAutoFocusIndex(index - 1);
                                        }
                                    }}
                                />
                            </StackItem>
                            <StackItem>
                                <IconButton
                                    className={moveDownClassName}
                                    iconProps={downButtonProps}
                                    disabled={index >= props.players.length - 1}
                                    onClick={() => {
                                        props.onMovePlayerBackward(player);
                                        if (index < props.players.length - 1) {
                                            setAutoFocusIsUp(false);
                                            setAutoFocusIndex(index + 1);
                                        }
                                    }}
                                />
                            </StackItem>
                        </Stack>
                    </PlayerEntry>
                </StackItem>
            </div>
        );
    }

    function insertBeforeItem(item: Player) {
        if (draggedItem == undefined) {
            return;
        }

        const locationIndex = props.players.indexOf(item);
        const itemIndex = props.players.indexOf(draggedItem);
        if (locationIndex !== itemIndex) {
            props.onMovePlayerToIndex(draggedItem, locationIndex);
        }
    }

    const dragDropEvents: IDragDropEvents = {
        canDrag: () => true,
        canDrop: () => true,
        onDragStart: (item?: Player) => {
            setDraggedItem(item);
        },
        onDragEnd: () => {
            setDraggedItem(undefined);
        },
        onDrop: (item?: Player) => {
            if (draggedItem && item) {
                insertBeforeItem(item);
                setDraggedItem(undefined);
            }
        },
    };

    return (
        <DetailsList
            checkboxVisibility={CheckboxVisibility.hidden}
            columns={columns}
            dragDropEvents={dragDropEvents}
            isHeaderVisible={false}
            items={props.players}
            onRenderItemColumn={renderPlayerRow}
            selectionMode={SelectionMode.single}
        ></DetailsList>
    );
});

export interface IPlayerRosterProps {
    canSetStarter: boolean;
    players: Player[];
    onMovePlayerForward: (player: Player) => void;
    onMovePlayerBackward: (player: Player) => void;
    onMovePlayerToIndex: (player: Player, index: number) => void;
}
