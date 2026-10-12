// Two teams are swapped from a message dialog; more are put in order in the Reorder Teams dialog. The logic lives
// here so it can be tested.

import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";

export function submit(appState: AppState): void {
    const players: Player[] = [...appState.activeGame.players];
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

    appState.activeGame.setPlayers(players);
}

// Team order is the order the teams' players first appear in, so reordering teams is reordering players: each
// team's players together, in the new team order, and in their own order within the team.
export function orderPlayersByTeams(players: Player[], teamNames: string[]): Player[] {
    const rank = new Map<string, number>(teamNames.map((name, index) => [name, index]));
    const rankOf = (player: Player): number => rank.get(player.teamName) ?? teamNames.length;
    return players
        .map((player, index) => ({ player, index }))
        .sort((a, b) => rankOf(a.player) - rankOf(b.player) || a.index - b.index)
        .map((entry) => entry.player);
}

export function moveTeam(appState: AppState, index: number, by: number): void {
    appState.uiState.dialogState.reorderTeamsDialog?.moveTeam(index, by);
}

export function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideReorderTeamsDialog();
}

export function submitOrder(appState: AppState): void {
    const dialog = appState.uiState.dialogState.reorderTeamsDialog;
    if (dialog == undefined) {
        return;
    }

    appState.activeGame.setPlayers(orderPlayersByTeams([...appState.activeGame.players], dialog.teamNames));
    hideDialog(appState);
}
