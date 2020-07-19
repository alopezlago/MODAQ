import React from "react";
import { observer } from "mobx-react";
import { IIconProps, Label, List } from "@fluentui/react";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { IconButton, IButtonStyles } from "@fluentui/react/lib/Button";

import * as NewGameValidator from "src/state/NewGameValidator";
import { Player } from "src/state/TeamState";
import { PlayerEntry } from "./PlayerEntry";
import { createUseStyles } from "react-jss";

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
export const TeamEntry = observer((props: ITeamEntryProps) => {
    const classes: ITeamEntryStyle = useStyles(props.playerListHeight);

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

    // TODO: Down key on the last player entry should trigger the addPlayerHandler
    return (
        <div className={classes.teamEntry}>
            <TextField
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
        </div>
    );
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
        <PlayerEntry
            canRemove={index !== 0}
            player={player}
            required={required}
            validateName={playerNameValidationHandler}
            onRemovePlayerClick={onRemovePlayerHandler}
        />
    );
}

function useStyles(playerListHeight: number | string): ITeamEntryStyle {
    return createUseStyles({
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
            border: "1px solid rgb(128, 128, 128)",
            padding: "5px 20px",
        },
    })();
}

export interface ITeamEntryProps {
    defaultTeamName: string;
    playerListHeight: string | number;
    players: Player[];
    teamLabel: string;
    teamNameErrorMessage?: string;

    onAddPlayerClick(existingPlayers: Player[]): void;
    onRemovePlayerClick(player: Player): void;
    validateTeamName(value: string): string | undefined;
}

interface ITeamEntryStyle {
    addButtonContainer: string;
    playerListContainer: string;
    teamEntry: string;
}
