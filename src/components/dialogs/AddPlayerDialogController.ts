import * as NewGameValidator from "../../state/NewGameValidator";
import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { Player } from "../../state/TeamState";
import { UIState } from "../../state/UIState";
import { AddPlayerDialogState } from "../../state/AddPlayerDialogState";

export function addPlayer(): void {
    const appState: AppState = AppState.instance;
    const game: GameState = appState.game;
    const uiState: UIState = appState.uiState;

    if (validatePlayer() != undefined) {
        return;
    }

    const dialogState: AddPlayerDialogState | undefined = uiState.dialogState.addPlayerDialog;
    if (dialogState == undefined) {
        throw new Error("Tried adding a player with no new player");
    }

    const newPlayer: Player = dialogState.player;

    game.addNewPlayer(newPlayer);

    // TODO: Only do this if the number of active players is less than the maximum number of active players
    // TODO: Add the inactive status to uiState
    game.cycles[uiState.cycleIndex].addPlayerJoins(newPlayer, !dialogState.isActive);

    hideDialog();
}

export function changePlayerName(newName: string): void {
    const appState: AppState = AppState.instance;
    appState.uiState.dialogState.addPlayerDialog?.setName(newName);
}

export function changeTeamName(teamName: string): void {
    const appState: AppState = AppState.instance;
    appState.uiState.dialogState.addPlayerDialog?.setTeamName(teamName);
}

export function setIsActive(isActive: boolean): void {
    const appState: AppState = AppState.instance;
    appState.uiState.dialogState.addPlayerDialog?.setIsActive(isActive);
}

export function validatePlayer(): string | undefined {
    const appState: AppState = AppState.instance;
    const newPlayer: Player | undefined = appState.uiState.dialogState.addPlayerDialog?.player;
    if (newPlayer == undefined) {
        throw new Error("Tried adding a player with no new player");
    }

    // Trim the player name on submit, so the user can type in spaces while creating the name in the UI
    const trimmedPlayerName: string = newPlayer.name.trim();
    if (trimmedPlayerName.length === 0) {
        return "Player name cannot be blank";
    }

    if (appState.game.teamNames.indexOf(newPlayer.teamName) === -1) {
        return "Team doesn't exist";
    }

    const playersOnTeam: Player[] = [...appState.game.getPlayers(newPlayer.teamName), newPlayer];
    return NewGameValidator.newPlayerNameUnique(playersOnTeam, trimmedPlayerName);
}

export function hideDialog(): void {
    const appState: AppState = AppState.instance;
    appState.uiState.dialogState.hideAddPlayerDialog();
}
