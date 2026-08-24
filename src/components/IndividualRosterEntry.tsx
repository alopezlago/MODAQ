import React from "react";
import { observer } from "mobx-react-lite";
import { Checkbox, ICheckboxStyles, Label, mergeStyleSets, Text } from "@fluentui/react";

import { Player } from "../state/TeamState";

const checkboxStyles: Partial<ICheckboxStyles> = {
    root: { alignItems: "center" },
    text: { fontSize: 12 },
};

/**
 * Picks the competitors for an individual game out of a loaded roster. Team games choose two rosters; an
 * individual format instead takes one player at a time, up to whatever the format allows.
 */
export const IndividualRosterEntry = observer(function IndividualRosterEntry(props: IIndividualRosterEntryProps) {
    const classes: IIndividualRosterEntryClassNames = getClassNames();

    const selectedNames: Set<string> = new Set(props.selectedPlayers.map((player) => player.name));
    const atCapacity: boolean = props.selectedPlayers.length >= props.maximumPlayerCount;

    if (props.playerPool.length === 0) {
        return (
            <Text className={classes.empty}>Load a roster file to choose the players in this room.</Text>
        );
    }

    // Roster players keep their registered team, which is worth showing so two people with similar names are
    // still tellable apart
    return (
        <div className={classes.entry}>
            <Label>{`Players (${props.selectedPlayers.length} of up to ${props.maximumPlayerCount})`}</Label>
            <div className={classes.pool}>
                {props.playerPool.map((player, index) => {
                    const isSelected: boolean = selectedNames.has(player.name);
                    return (
                        <div className={classes.row} key={`rosterPlayer_${index}`}>
                            <Checkbox
                                label={player.name}
                                checked={isSelected}
                                disabled={!isSelected && atCapacity}
                                styles={checkboxStyles}
                                onChange={() => props.onTogglePlayer(player)}
                            />
                            {player.teamName !== player.name && (
                                <Text className={classes.team} title={player.teamName}>
                                    {player.teamName}
                                </Text>
                            )}
                        </div>
                    );
                })}
            </div>
            {atCapacity && (
                <Text className={classes.note}>
                    {`That's the most this format allows. Clear a player to pick someone else.`}
                </Text>
            )}
        </div>
    );
});

export interface IIndividualRosterEntryProps {
    maximumPlayerCount: number;
    playerPool: Player[];
    selectedPlayers: Player[];
    onTogglePlayer(player: Player): void;
}

interface IIndividualRosterEntryClassNames {
    empty: string;
    entry: string;
    note: string;
    pool: string;
    row: string;
    team: string;
}

const getClassNames = (): IIndividualRosterEntryClassNames =>
    mergeStyleSets({
        empty: {
            display: "block",
            fontSize: 12,
            padding: "10px 0",
        },
        entry: {
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
        },
        note: {
            display: "block",
            fontSize: 12,
            marginTop: 6,
        },
        // Several columns so a full field doesn't turn the dialog into a long scroll
        pool: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            columnGap: 20,
            rowGap: 2,
        },
        row: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            minWidth: 0,
            padding: "2px 0",
        },
        team: {
            fontSize: 11,
            opacity: 0.7,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "45%",
        },
    });
