import React from "react";
import { observer } from "mobx-react-lite";
import { Dropdown, IDropdownOption, List, mergeStyleSets } from "@fluentui/react";

import { Player } from "src/state/TeamState";
import { PlayerEntry } from "./PlayerEntry";

export const FromRostersTeamEntry = observer(function FromRostersTeamEntry(props: IFromRostersTeamEntryProps)  {
    const classes: ITeamEntryClassNames = getClassNames(props.playerListHeight);

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
            />
            <div className={classes.playerListContainer} data-is-scrollable="true">
                <List items={[...props.players]} onRenderCell={onRenderPlayerEntry} />
            </div>
        </div>
    );
});

function onRenderPlayerEntry(player: Player | undefined): JSX.Element {
    if (player == undefined) {
        return <></>;
    }

    return <PlayerEntry player={player} readonly={true} />;
}

// TODO: Unify with ManualTeamEntry
const getClassNames = (playerListHeight: number | string): ITeamEntryClassNames =>
    mergeStyleSets({
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

export interface IFromRostersTeamEntryProps {
    initialTeamName?: string;
    playerListHeight: string | number;
    players: Player[];
    playerPool: Player[];
    teamLabel: string;
    teamNameErrorMessage?: string;
    onTeamChange(newTeamName: string, players: Player[]): void;
}

interface ITeamEntryClassNames {
    playerListContainer: string;
    teamEntry: string;
}
