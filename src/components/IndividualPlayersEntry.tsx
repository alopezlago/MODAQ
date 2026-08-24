import React from "react";
import { observer } from "mobx-react-lite";
import { FocusZone, FocusZoneDirection, IIconProps, Label, mergeStyleSets, Text } from "@fluentui/react";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { IconButton, IButtonStyles } from "@fluentui/react/lib/Button";

import * as NewGameValidator from "../state/NewGameValidator";
import { CancelButton } from "./CancelButton";
import { Player } from "../state/TeamState";

const addButtonProps: IIconProps = {
    iconName: "Add",
};

const playerNameStyle: Partial<ITextFieldStyles> = {
    root: {
        flexGrow: 1,
        minWidth: 0,
    },
};

const addPlayerButtonStyle: Partial<IButtonStyles> = {
    root: {
        display: "flex",
        justifyContent: "center",
    },
};

/**
 * Roster entry for individual formats like IPNCT, where players compete on their own instead of on teams. Each
 * competitor is one row, and there's no team name to fill in, since the player's name is their team's name.
 */
export const IndividualPlayersEntry = observer(function IndividualPlayersEntry(props: IIndividualPlayersEntryProps) {
    const classes: IIndividualPlayersEntryClassNames = getClassNames();

    const addPlayerHandler = React.useCallback(() => props.onAddPlayerClick(), [props]);

    // The reader can always cut a name back down to nothing, so blank rows are simply left out of the game
    const namedPlayerCount: number = props.players.filter((player) => player.name.trim() !== "").length;
    const canAddPlayer: boolean = props.players.length < props.maximumPlayerCount;

    return (
        <FocusZone direction={FocusZoneDirection.vertical} className={classes.entry}>
            <Label>Players</Label>
            <Text className={classes.description}>
                {`Each player competes on their own. Up to ${props.maximumPlayerCount} players; blank names are skipped.`}
            </Text>
            <div className={classes.playerList}>
                {props.players.map((player, index) => (
                    <IndividualPlayerRow
                        key={`individualPlayer_${index}`}
                        canRemove={props.players.length > 2}
                        index={index}
                        player={player}
                        players={props.players}
                        onRemovePlayerClick={props.onRemovePlayerClick}
                    />
                ))}
            </div>
            <div className={classes.addButtonContainer}>
                <IconButton
                    iconProps={addButtonProps}
                    title={canAddPlayer ? "Add player" : `A game can only have ${props.maximumPlayerCount} players`}
                    styles={addPlayerButtonStyle}
                    onClick={addPlayerHandler}
                    disabled={!canAddPlayer}
                />
            </div>
            <Text className={classes.description}>{`${namedPlayerCount} player(s) entered`}</Text>
        </FocusZone>
    );
});

const IndividualPlayerRow = observer(function IndividualPlayerRow(props: IIndividualPlayerRowProps) {
    const classes: IIndividualPlayersEntryClassNames = getClassNames();

    const nameChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newName?: string) => {
            if (newName == undefined) {
                return;
            }

            props.player.setName(newName);

            // The player is their own team, so the team name has to follow the player's name
            props.player.setTeamName(newName.trim());
        },
        [props.player]
    );

    const nameValidationHandler = React.useCallback(
        (newName: string): string | undefined => NewGameValidator.individualPlayerNameUnique(props.players, newName),
        [props.players]
    );

    const removeHandler = React.useCallback(() => props.onRemovePlayerClick(props.player), [props]);

    return (
        <div className={classes.playerRow}>
            {/* The number is its own element rather than the TextField's prefix, since a prefix takes over the
                field's accessible name */}
            <span aria-hidden="true" className={classes.playerNumber}>
                {props.index + 1}
            </span>
            <TextField
                ariaLabel={`Player ${props.index + 1}`}
                onChange={nameChangeHandler}
                onGetErrorMessage={nameValidationHandler}
                required={props.index < 2}
                styles={playerNameStyle}
                validateOnFocusOut={true}
                value={props.player.name}
            />
            {props.canRemove ? <CancelButton tooltip="Remove" onClick={removeHandler} /> : <span className={classes.spacer} />}
        </div>
    );
});

export interface IIndividualPlayersEntryProps {
    maximumPlayerCount: number;
    players: Player[];
    onAddPlayerClick(): void;
    onRemovePlayerClick(player: Player): void;
}

interface IIndividualPlayerRowProps {
    canRemove: boolean;
    index: number;
    player: Player;
    players: Player[];
    onRemovePlayerClick(player: Player): void;
}

interface IIndividualPlayersEntryClassNames {
    addButtonContainer: string;
    description: string;
    entry: string;
    playerList: string;
    playerNumber: string;
    playerRow: string;
    spacer: string;
}

const getClassNames = (): IIndividualPlayersEntryClassNames =>
    mergeStyleSets({
        addButtonContainer: {
            display: "flex",
            justifyContent: "center",
        },
        description: {
            display: "block",
            fontSize: 12,
            marginBottom: 10,
        },
        entry: {
            display: "flex",
            flexDirection: "column",
            padding: "5px 20px",
            minWidth: 0,
        },
        // Two columns so sixteen players don't turn the dialog into a long scroll
        playerList: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            columnGap: 20,
        },
        playerNumber: {
            fontSize: 12,
            marginRight: 6,
            // Keeps the name fields lined up whether the number is one digit or two
            minWidth: 16,
            textAlign: "right",
        },
        playerRow: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            margin: "3px 0",
            minWidth: 0,
        },
        spacer: {
            width: 32,
        },
    });
