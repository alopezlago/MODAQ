import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { ReorderPlayersDialogState } from "../../state/ReorderPlayersDialogState";

export function changeTeamName(appState: AppState, newName: string): void {
    const reorderPlayersDialog: ReorderPlayersDialogState | undefined =
        appState.uiState.dialogState.reorderPlayersDialog;
    if (reorderPlayersDialog == undefined) {
        return;
    }

    reorderPlayersDialog.setTeamName(newName);
}

export function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideReorderPlayersDialog();
}

export function moveBackward(appState: AppState, player: Player): void {
    appState.uiState.dialogState.reorderPlayersDialog?.movePlayerBackward(player);
}

export function moveForward(appState: AppState, player: Player): void {
    appState.uiState.dialogState.reorderPlayersDialog?.movePlayerForward(player);
}

export function movePlayerToIndex(appState: AppState, player: Player, index: number): void {
    appState.uiState.dialogState.reorderPlayersDialog?.movePlayerToIndex(player, index);
}

export function submit(appState: AppState): void {
    const game: GameState = appState.game;
    const reorderPlayersDialogState: ReorderPlayersDialogState | undefined =
        appState.uiState.dialogState.reorderPlayersDialog;
    if (reorderPlayersDialogState == undefined) {
        return;
    }

    game.setPlayers(reorderPlayersDialogState.players);

    hideDialog(appState);
}
