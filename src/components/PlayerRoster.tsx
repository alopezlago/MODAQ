// List of players that can be re-organized through drag+drop
import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    IStackTokens,
    IColumn,
    IIconProps,
    IDragDropEvents,
    IButtonStyles,
    IconButton,
    Stack,
    StackItem,
    CheckboxVisibility,
    DetailsList,
    SelectionMode,
    IStackStyles,
    mergeStyleSets,
} from "@fluentui/react";

import { Player } from "../state/TeamState";
import { PlayerEntry } from "./PlayerEntry";

const buttonTokens: IStackTokens = { childrenGap: 4 };

// Larger hit target so it's easier to nudge players up and down in the order, with minimal padding
const moveButtonStyles: IButtonStyles = {
    root: {
        width: 32,
        height: 32,
        padding: 0,
    },
    icon: {
        fontSize: 18,
        margin: 0,
    },
};

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

// Lookup class used to refocus a row after it's moved with a number-key shortcut
const playerRowClassName = "playerRosterRow";

const classNames = mergeStyleSets({
    playerRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        outline: "none",
        selectors: {
            ":focus": {
                outline: "2px solid #0078d4",
                outlineOffset: -2,
            },
        },
    },
});

const moveDownClassName = "moveDownButton";
const moveUpClassName = "moveUpButton";

// Highest position reachable with the number-key shortcut (press 1-8 to move a selected player to that spot)
const maxShortcutPosition = 8;

// Accessibility issue: can't tab/move to the checkbox; it's taken over by the buttons
export const PlayerRoster = observer(function PlayerRoster(props: IPlayerRosterProps): JSX.Element {
    const [draggedItem, setDraggedItem] = React.useState<Player | undefined>(undefined);
    const [autoFocusIndex, setAutoFocusIndex] = React.useState<number | undefined>(undefined);
    const [autoFocusIsUp, setAutoFocusIsUp] = React.useState<boolean>(false);
    const [autoFocusRowIndex, setAutoFocusRowIndex] = React.useState<number | undefined>(undefined);
    const [teamName, setTeamName] = React.useState<string | undefined>(undefined);
    const listContainerRef = React.useRef<HTMLDivElement>(null);

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

    React.useEffect(() => {
        // Keep focus on the row that was just moved with a number-key shortcut, so it can be moved again
        if (autoFocusRowIndex != undefined) {
            const rows = listContainerRef.current?.getElementsByClassName(playerRowClassName);
            const element = rows?.[autoFocusRowIndex] as HTMLElement | undefined;
            if (element) {
                element.focus();
            }

            setAutoFocusRowIndex(undefined);
        }
        // props.players is intentionally not a dependency: under MobX it's a stable reference, so it would never
        // re-trigger this effect. Focus is driven entirely by autoFocusRowIndex, which we reset to undefined above so
        // the effect re-fires every time the shortcut is used.
    }, [autoFocusRowIndex, setAutoFocusRowIndex]);

    function onRowKeyDown(ev: React.KeyboardEvent<HTMLDivElement>, player: Player, index: number): void {
        // Pressing 1-8 while a player is selected swaps that player to the matching position
        if (ev.key.length !== 1 || ev.key < "1" || ev.key > String(maxShortcutPosition)) {
            return;
        }

        const targetIndex = Number.parseInt(ev.key, 10) - 1;
        ev.preventDefault();
        ev.stopPropagation();

        if (targetIndex < props.players.length && targetIndex !== index) {
            props.onMovePlayerToIndex(player, targetIndex);
            setAutoFocusRowIndex(targetIndex);
        }
    }

    function renderPlayerRow(player: Player | undefined, index: number | undefined) {
        if (player == undefined || index == undefined) {
            return <></>;
        }

        return (
            <div
                className={`${classNames.playerRow} ${playerRowClassName}`}
                tabIndex={0}
                title="Press 1-8 to move this player to that position"
                onKeyDown={(ev) => onRowKeyDown(ev, player, index)}
            >
                <StackItem styles={playerEntryStyle}>
                    <PlayerEntry
                        player={player}
                        isNameReadonly={true}
                        canSetStarter={props.canSetStarter}
                        fillWidth={true}
                    >
                        <Stack horizontal={true} tokens={buttonTokens} verticalAlign="center">
                            <StackItem>
                                <IconButton
                                    className={moveUpClassName}
                                    iconProps={upButtonProps}
                                    styles={moveButtonStyles}
                                    title="Move up"
                                    ariaLabel={`Move ${player.name} up`}
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
                                    styles={moveButtonStyles}
                                    title="Move down"
                                    ariaLabel={`Move ${player.name} down`}
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
        <div ref={listContainerRef}>
            <DetailsList
                checkboxVisibility={CheckboxVisibility.hidden}
                columns={columns}
                dragDropEvents={dragDropEvents}
                isHeaderVisible={false}
                items={props.players}
                onRenderItemColumn={renderPlayerRow}
                selectionMode={SelectionMode.single}
                compact={true}
            ></DetailsList>
        </div>
    );
});

export interface IPlayerRosterProps {
    canSetStarter: boolean;
    players: Player[];
    onMovePlayerForward: (player: Player) => void;
    onMovePlayerBackward: (player: Player) => void;
    onMovePlayerToIndex: (player: Player, index: number) => void;
}
