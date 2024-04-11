// For now this just uses a message dialog, but we want the logic someplace where we can test it

import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";

export function submit(): void {
    const appState: AppState = AppState.instance;
    const players: Player[] = [...appState.game.players];
    if (players.length < 2) {
        return;
    }

    const firstPlayer: Player = players[0];
    const otherPlayerIndex: number = players.findIndex((player) => player.teamName !== firstPlayer.teamName);
    if (otherPlayerIndex === -1) {
        return;
    }

    players[0] = players[otherPlayerIndex];
    players[otherPlayerIndex] = firstPlayer;

    appState.game.setPlayers(players);
}
