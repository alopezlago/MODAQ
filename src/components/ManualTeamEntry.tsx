import React from "react";
import { observer } from "mobx-react-lite";
import { FocusZone, FocusZoneDirection, IIconProps, Label, List, mergeStyleSets } from "@fluentui/react";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { IconButton, IButtonStyles } from "@fluentui/react/lib/Button";

import * as NewGameValidator from "../state/NewGameValidator";
import { Player } from "../state/TeamState";
import { PlayerEntry } from "./PlayerEntry";

const teamEntryClassName = "team-name-entry";
const listCellClassName = "ms-List-cell";

const addButtonProps: IIconProps = {
    iconName: "Add",
};

const teamNameStyle: Partial<ITextFieldStyles> = {
    root: {
        width: "100%",
        marginBottom: 10,
    },
};

const addPlayerButtonStyle: Partial<IButtonStyles> = {
    root: {
        display: "flex",
        justifyContent: "center",
    },
};

// I looked into using a DetailsList instead of a List, so we could get rid of the Starter label on each checkbox, but
// the column label is usually cut off, defeating the purpose
export const ManualTeamEntry = observer(function ManualTeamEntry(props: IManualTeamEntryProps) {
    const classes: ITeamEntryClassNames = getClassNames(props.playerListHeight);

    const nameChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newName?: string) => {
            if (newName != undefined) {
                const trimmedName: string = newName.trim();
                for (const player of props.players) {
                    player.setTeamName(trimmedName);
                }
            }
        },
        [props.players]
    );
    const addPlayerHandler = React.useCallback(() => props.onAddPlayerClick(props.players), [props]);
    const playerNameValidationHandler = React.useCallback(
        (newName: string): string | undefined => {
            return NewGameValidator.newPlayerNameUnique(props.players, newName);
        },
        [props.players]
    );

    const renderPlayerHandler = React.useCallback(
        (player: Player | undefined, index: number | undefined) =>
            onRenderPlayerEntry(player, index, playerNameValidationHandler, props.onRemovePlayerClick),
        [playerNameValidationHandler, props.onRemovePlayerClick]
    );

    if (props.players.length === 0) {
        return <></>;
    }

    const addButtonDisabled: boolean = props.players.findIndex((player) => player.name === "") >= 0;

    // Use a focus zone so that we only tab to a team entry instead of everything tabbable within the team entry
    return (
        <FocusZone direction={FocusZoneDirection.vertical} className={classes.teamEntry} onKeyDown={focusZoneKeyDown}>
            <TextField
                className={teamEntryClassName}
                label={props.teamLabel}
                defaultValue={props.defaultTeamName}
                errorMessage={props.teamNameErrorMessage}
                multiline={false}
                onChange={nameChangeHandler}
                required={true}
                styles={teamNameStyle}
                validateOnFocusOut={true}
            />
            <Label>Names</Label>
            <div className={classes.playerListContainer} data-is-scrollable="true">
                <List items={[...props.players]} onRenderCell={renderPlayerHandler} />
            </div>
            <div className={classes.addButtonContainer}>
                <IconButton
                    iconProps={addButtonProps}
                    title="Add player"
                    styles={addPlayerButtonStyle}
                    onClick={addPlayerHandler}
                    disabled={addButtonDisabled}
                />
            </div>
        </FocusZone>
    );

    function focusZoneKeyDown(ev?: React.KeyboardEvent<HTMLElement>): void {
        if (ev == undefined) {
            return;
        }

        let change = 0;
        switch (ev.key) {
            case "ArrowDown":
                // Go down a class if possible
                change = 1;
                break;
            case "ArrowUp":
                // Go up a class if possible
                change = -1;
                break;
            default:
                return;
        }

        // We doing focus handling manually here because Fabric UI isn't liking the nested FocusZones
        const target: HTMLElement = ev.target as HTMLElement;

        // Find the manual team entry container class, so we can look for other elements under it
        let cellContainer = null;
        let rootContainer = target;
        while (rootContainer.parentElement != undefined && rootContainer.className.indexOf(classes.teamEntry) === -1) {
            if (rootContainer.className.indexOf(listCellClassName) !== -1) {
                cellContainer = rootContainer;
            }

            rootContainer = rootContainer.parentElement;
        }

        const cells = rootContainer.querySelectorAll("." + listCellClassName);

        ev.stopPropagation();
        ev.preventDefault();

        // The class name isn't on the element that is focused, but on a child of it
        if (
            target.id != undefined &&
            target.id.length > 0 &&
            rootContainer.querySelector(`.${teamEntryClassName} #${target.id}`) != undefined
        ) {
            // Only go to the first cell if we pressed down
            if (ev.key === "ArrowDown") {
                // Focus on the first input of the first cell
                focusOnFirstInputInPlayerEntry(cells[0] as HTMLElement);
            }

            return;
        } else if (
            target.tagName === "BUTTON" &&
            rootContainer.querySelector("." + classes.addButtonContainer + " button") === target
        ) {
            if (ev.key === "ArrowUp") {
                // Focus on the first input of the last cell
                focusOnFirstInputInPlayerEntry(cells[cells.length - 1] as HTMLElement);
            }

            return;
        }

        if (cellContainer == undefined) {
            // We're not in a cell, something weird has happened
            return;
        }

        const rawListIndex: string | null = cellContainer.getAttribute("data-list-index");
        if (rawListIndex == undefined) {
            return;
        }

        let listIndex = Number.parseInt(rawListIndex);
        listIndex += change;

        if (listIndex >= cells.length) {
            // Focus on the add player button if possible
            const addButtonContainer: HTMLElement | null = rootContainer.getElementsByClassName(
                classes.addButtonContainer
            )[0] as HTMLElement;
            if (addButtonContainer == undefined) {
                return;
            }

            const addButton: HTMLElement | null = addButtonContainer.getElementsByTagName("button")[0] as HTMLElement;
            if (addButton == undefined) {
                return;
            }

            if (addButton.getAttribute("is-disabled") == null) {
                addButton.focus();
            }

            return;
        } else if (listIndex < 0) {
            // Focus on the team name entry
            const element: HTMLElement | null = rootContainer.querySelector(
                `.${teamEntryClassName} input`
            ) as HTMLElement;
            element?.focus();
        }

        // Find the cell we need to go to, then focus on the same control if possible
        const focusedCell: HTMLElement | null = cells[listIndex].firstChild as HTMLElement;
        if (focusedCell == null) {
            return;
        }

        // If we can get the control, go to it. Right now only the player name text box isn't selectable, but that's
        // also the first element
        const targetInNewCell: HTMLCollectionOf<Element> = focusedCell.getElementsByClassName(target.className);
        if (targetInNewCell.length === 0) {
            // Focus on the first input
            focusOnFirstInputInPlayerEntry(focusedCell);
        } else {
            (targetInNewCell[0] as HTMLElement).focus();
        }
    }
});

function onRenderPlayerEntry(
    player: Player | undefined,
    index: number | undefined,
    playerNameValidationHandler: (newName: string) => string | undefined,
    onRemovePlayerHandler: (player: Player) => void
): JSX.Element {
    if (index === undefined || player == undefined) {
        return <></>;
    }

    const required: boolean = index === 0;
    return (
        <FocusZone as="div" direction={FocusZoneDirection.horizontal}>
            <PlayerEntry
                canRemove={index !== 0}
                player={player}
                required={required}
                validateName={playerNameValidationHandler}
                onRemovePlayerClick={onRemovePlayerHandler}
            />
        </FocusZone>
    );
}

function focusOnFirstInputInPlayerEntry(playerEntryElement: HTMLElement): void {
    // Focus on the first input in the player entry
    playerEntryElement.getElementsByTagName("input")[0].focus();
}

const getClassNames = (playerListHeight: number | string): ITeamEntryClassNames =>
    mergeStyleSets({
        addButtonContainer: {
            display: "flex",
            justifyContent: "center",
        },
        playerListContainer: {
            height: playerListHeight,
            marginBottom: 10,
            overflowY: "auto",
        },
        teamEntry: {
            display: "flex",
            flexDirection: "column",
            padding: "5px 20px",
        },
    });

export interface IManualTeamEntryProps {
    defaultTeamName: string;
    playerListHeight: string | number;
    players: Player[];
    teamLabel: string;
    teamNameErrorMessage?: string;
    onAddPlayerClick(existingPlayers: Player[]): void;
    onRemovePlayerClick(player: Player): void;
    validateTeamName(value: string): string | undefined;
}

interface ITeamEntryClassNames {
    addButtonContainer: string;
    playerListContainer: string;
    teamEntry: string;
}
