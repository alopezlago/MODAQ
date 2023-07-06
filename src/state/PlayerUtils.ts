import { IPlayer, Player } from "./TeamState";

export function playersEqual(player: IPlayer, other: IPlayer): boolean {
    return player.name === other.name && player.teamName === other.teamName;
}

export function movePlayerBackward(players: Player[], player: Player): Player[] {
    // Make a copy so that we don't overwrite the original array
    players = [...players];

    let nextTeammateIndex = -1;
    for (let i = players.length - 1; i >= 0; i--) {
        const currentPlayer: IPlayer = players[i];
        if (player === currentPlayer) {
            if (nextTeammateIndex === -1) {
                // Current player is in front, we can't move them
                return players;
            }

            players[i] = players[nextTeammateIndex];
            players[nextTeammateIndex] = player;
            return players;
        }

        if (players[i].teamName === player.teamName) {
            nextTeammateIndex = i;
        }
    }

    return players;
}

export function movePlayerForward(players: Player[], player: Player): Player[] {
    // Make a copy so that we don't overwrite the original array
    players = [...players];

    let previousTeammateIndex = -1;
    for (let i = 0; i < players.length; i++) {
        const currentPlayer: IPlayer = players[i];
        if (player === currentPlayer) {
            if (previousTeammateIndex === -1) {
                // Current player is in front, we can't move them
                return players;
            }

            players[i] = players[previousTeammateIndex];
            players[previousTeammateIndex] = player;
            return players;
        }

        if (players[i].teamName === player.teamName) {
            previousTeammateIndex = i;
        }
    }

    return players;
}

export function movePlayerToIndex(players: Player[], player: Player, index: number): Player[] {
    if (index < 0) {
        return players;
    }

    const teamName: string = player.teamName;
    let sameTeamCount = -1;
    for (let i = 0; i < players.length; i++) {
        const currentPlayer: IPlayer = players[i];
        if (currentPlayer.teamName === teamName) {
            sameTeamCount++;
        }

        if (sameTeamCount === index) {
            let newPlayers = players.filter((p) => p !== player);
            newPlayers = newPlayers.slice(0, i).concat(player).concat(newPlayers.slice(i));
            return newPlayers;
        }
    }

    // Index is beyond the number of players in the team. Treat it as a no-op
    return players;
}
