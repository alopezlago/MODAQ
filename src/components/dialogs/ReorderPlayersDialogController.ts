import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { ReorderPlayersDialogState } from "../../state/ReorderPlayersDialogState";

export function changeTeamName(newName: string): void {
    const appState: AppState = AppState.instance;
    const reorderPlayersDialog: ReorderPlayersDialogState | undefined =
        appState.uiState.dialogState.reorderPlayersDialog;
    if (reorderPlayersDialog == undefined) {
        return;
    }

    reorderPlayersDialog.setTeamName(newName);
}

export function hideDialog(): void {
    const appState: AppState = AppState.instance;
    appState.uiState.dialogState.hideReorderPlayersDialog();
}

export function moveBackward(player: Player): void {
    AppState.instance.uiState.dialogState.reorderPlayersDialog?.movePlayerBackward(player);
}

export function moveForward(player: Player): void {
    AppState.instance.uiState.dialogState.reorderPlayersDialog?.movePlayerForward(player);
}

export function movePlayerToIndex(player: Player, index: number): void {
    AppState.instance.uiState.dialogState.reorderPlayersDialog?.movePlayerToIndex(player, index);
}

export function submit(): void {
    const appState: AppState = AppState.instance;
    const game: GameState = appState.game;
    const reorderPlayersDialogState: ReorderPlayersDialogState | undefined =
        appState.uiState.dialogState.reorderPlayersDialog;
    if (reorderPlayersDialogState == undefined) {
        return;
    }

    game.setPlayers(reorderPlayersDialogState.players);

    hideDialog();
}
