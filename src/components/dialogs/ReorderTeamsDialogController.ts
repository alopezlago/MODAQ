// For now this just uses a message dialog, but we want the logic someplace where we can test it

import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";

export function submit(appState: AppState): void {
    const players: readonly Player[] = appState.activeGame.players;
    if (players.length < 2) {
        return;
    }

    const firstTeamName: string = players[0].teamName;
    const otherTeamPlayers: Player[] = players.filter((player) => player.teamName !== firstTeamName);
    if (otherTeamPlayers.length === 0) {
        return;
    }

    const firstTeamPlayers: Player[] = players.filter((player) => player.teamName === firstTeamName);
    appState.activeGame.setPlayers([...otherTeamPlayers, ...firstTeamPlayers]);
}
