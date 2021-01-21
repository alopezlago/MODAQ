import * as PendingNewGameUtils from "./PendingNewGameUtils";
import { Player } from "./TeamState";
import { IPendingNewGame } from "./IPendingNewGame";

export function isValid(pendingNewGame: IPendingNewGame): boolean {
    const [firstTeamPlayers, secondTeamPlayers]: Player[][] = PendingNewGameUtils.getPendingNewGamePlayers(
        pendingNewGame
    );

    const nonEmptyFirstTeamPlayers: Player[] = firstTeamPlayers.filter((player) => player.name !== "");
    if (nonEmptyFirstTeamPlayers.length === 0) {
        return false;
    }

    const nonEmptySecondTeamPlayers: Player[] = secondTeamPlayers.filter((player) => player.name !== "");
    if (nonEmptySecondTeamPlayers.length === 0) {
        return false;
    }

    return (
        playerTeamsUnique(nonEmptyFirstTeamPlayers, nonEmptySecondTeamPlayers) === undefined &&
        playerNamesUnique(nonEmptyFirstTeamPlayers) &&
        playerNamesUnique(nonEmptySecondTeamPlayers) &&
        atLeastOneStarter(nonEmptyFirstTeamPlayers) &&
        atLeastOneStarter(nonEmptySecondTeamPlayers) &&
        pendingNewGame.packet.tossups.length !== 0
    );
}

export function playerTeamsUnique(firstTeamPlayers: Player[], secondTeamPlayers: Player[]): string | undefined {
    if (
        firstTeamPlayers == undefined ||
        firstTeamPlayers.length === 0 ||
        secondTeamPlayers == undefined ||
        secondTeamPlayers.length === 0
    ) {
        return undefined;
    }

    if (firstTeamPlayers[0].teamName === secondTeamPlayers[0].teamName) {
        return "Team names must be unique";
    }

    return undefined;
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

// TODO: When the format interface is better understood, validate that # starters doesn't exceed the maximum
function playerNamesUnique(players: Player[]): boolean {
    const nameSet = new Set<string>(players.map((player) => player.name));
    return nameSet.size === players.length;
}

function atLeastOneStarter(players: Player[]): boolean {
    return players.some((player) => player.isStarter);
}
