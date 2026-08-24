import * as GameFormats from "./GameFormats";
import * as PendingNewGameUtils from "./PendingNewGameUtils";
import { Player } from "./TeamState";
import { IPendingNewGame, PendingGameType } from "./IPendingNewGame";

export function isValid(pendingNewGame: IPendingNewGame): boolean {
    const teams: Player[][] = PendingNewGameUtils.getPendingNewGamePlayers(pendingNewGame);

    const nonEmptyTeams: Player[][] = teams
        .map((teamPlayers) => teamPlayers.filter((player) => player.name !== ""))
        .filter((teamPlayers) => teamPlayers.length > 0);

    // A game needs at least two competitors, and an individual format caps how many it can have
    if (nonEmptyTeams.length < 2 || nonEmptyTeams.length > GameFormats.getMaximumTeamCount(pendingNewGame.gameFormat)) {
        return false;
    }

    return (
        teamNamesUnique(nonEmptyTeams) === undefined &&
        nonEmptyTeams.every((teamPlayers) => playerNamesUnique(teamPlayers) && atLeastOneStarter(teamPlayers)) &&
        atLeastOneCycleIfCyclesExist(pendingNewGame) &&
        pendingNewGame.packet.tossups.length !== 0
    );
}

export function playerTeamsUnique(firstTeamPlayers: Player[], secondTeamPlayers: Player[]): string | undefined {
    return teamNamesUnique([firstTeamPlayers, secondTeamPlayers]);
}

/**
 * Verifies that no two teams share a name. In an individual format each competitor is their own team, so this is
 * also what keeps two players from entering the same name.
 */
export function teamNamesUnique(teams: Player[][]): string | undefined {
    const teamNames: string[] = teams
        .filter((teamPlayers) => teamPlayers != undefined && teamPlayers.length > 0)
        .map((teamPlayers) => teamPlayers[0].teamName);

    if (teamNames.length < 2) {
        return undefined;
    }

    return new Set<string>(teamNames).size === teamNames.length ? undefined : "Team names must be unique";
}

export function newPlayerNameUnique(players: Player[], newName: string): string | undefined {
    if (players.length === 0) {
        // No players to validate against
        return undefined;
    } else if (newName === "") {
        // Empty named players should be treated as non-existent
        return undefined;
    }

    const trimmedNewName = newName.trim();
    let playerFound = false;
    for (const player of players) {
        if (player.name.trim() === trimmedNewName) {
            if (playerFound) {
                return "Player names must be unique on each team";
            } else {
                playerFound = true;
            }
        }
    }

    return undefined;
}

/**
 * Verifies that no two competitors in an individual game share a name. Unlike newPlayerNameUnique, players
 * without a name yet are ignored, since the form starts with several blank entries.
 */
export function individualPlayerNameUnique(players: Player[], newName: string): string | undefined {
    const trimmedNewName: string = newName.trim();
    if (trimmedNewName === "") {
        return undefined;
    }

    const matchCount: number = players.filter((player) => player.name.trim() === trimmedNewName).length;
    return matchCount > 1 ? "Player names must be unique" : undefined;
}

// TODO: When the format interface is better understood, validate that # starters doesn't exceed the maximum
function playerNamesUnique(players: Player[]): boolean {
    const nameSet = new Set<string>(players.map((player) => player.name));
    return nameSet.size === players.length;
}

function atLeastOneStarter(players: Player[]): boolean {
    return players.some((player) => player.isStarter);
}

function atLeastOneCycleIfCyclesExist(pendingNewGame: IPendingNewGame): boolean {
    return (
        pendingNewGame.type !== PendingGameType.Manual ||
        pendingNewGame.manual.cycles == undefined ||
        pendingNewGame.manual.cycles.length > 0
    );
}
