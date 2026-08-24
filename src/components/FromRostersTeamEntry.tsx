import React from "react";
import { observer } from "mobx-react-lite";
import { Dropdown, IDropdownOption, IDropdownStyles, mergeStyleSets } from "@fluentui/react";

import { Player } from "../state/TeamState";
import { PlayerRoster } from "./PlayerRoster";

// Team names come from whatever the registration file has, which can be much longer than the space for them. Keep
// the closed dropdown to one line (the full name is in its tooltip), and let the open list wrap so the moderator
// can still tell two long names apart.
const teamDropdownStyles: Partial<IDropdownStyles> = {
    dropdown: { minWidth: 0 },
    title: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    dropdownItem: { height: "auto", minHeight: 32 },
    dropdownItemSelected: { height: "auto", minHeight: 32 },
    dropdownOptionText: {
        overflow: "visible",
        whiteSpace: "normal",
        wordBreak: "break-word",
    },
};

export const FromRostersTeamEntry = observer(function FromRostersTeamEntry(props: IFromRostersTeamEntryProps) {
    const classes: ITeamEntryClassNames = getClassNames();

    const partChangeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
            if (option?.text != undefined) {
                props.onTeamChange(option.text, props.players);
            }
        },
        [props]
    );

    if (props.playerPool.length === 0) {
        return <></>;
    }

    const selectedTeamName: string | undefined = props.players.length > 0 ? props.players[0].teamName : undefined;
    const set: Set<string> = new Set(props.playerPool.map((player) => player.teamName));
    const teamOptions: IDropdownOption[] = [];
    for (const teamName of set.values()) {
        teamOptions.push({
            key: teamName,
            text: teamName,
            title: teamName,
        });
    }

    return (
        <div className={classes.teamEntry}>
            <Dropdown
                label={props.teamLabel}
                options={teamOptions}
                selectedKey={selectedTeamName}
                onChange={partChangeHandler}
                errorMessage={props.teamNameErrorMessage}
                styles={teamDropdownStyles}
                title={selectedTeamName}
            />
            <div className={classes.playerListContainer}>
                <PlayerRoster
                    canSetStarter={true}
                    players={props.players}
                    onMovePlayerBackward={props.onMovePlayerBackward}
                    onMovePlayerForward={props.onMovePlayerForward}
                    onMovePlayerToIndex={props.onMovePlayerToIndex}
                />
            </div>
        </div>
    );
});

// TODO: Unify with ManualTeamEntry
const getClassNames = (): ITeamEntryClassNames =>
    mergeStyleSets({
        // The whole dialog scrolls when needed, so this list isn't separately scrollable
        playerListContainer: {
            marginBottom: 10,
        },
        teamEntry: {
            display: "flex",
            flexDirection: "column",
            padding: "5px 8px",
            // Without this, a long team name sets the column's minimum width and pushes the other team (and the
            // starter checkboxes) off the edge of the dialog
            minWidth: 0,
        },
    });

export interface IFromRostersTeamEntryProps {
    initialTeamName?: string;
    players: Player[];
    playerPool: Player[];
    teamLabel: string;
    teamNameErrorMessage?: string;
    onMovePlayerBackward: (player: Player) => void;
    onMovePlayerForward: (player: Player) => void;
    onMovePlayerToIndex: (player: Player, index: number) => void;
    onTeamChange(newTeamName: string, players: Player[]): void;
}

interface ITeamEntryClassNames {
    playerListContainer: string;
    teamEntry: string;
}
