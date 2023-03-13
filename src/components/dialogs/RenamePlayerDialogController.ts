import * as NewGameValidator from "../../state/NewGameValidator";
import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { Player } from "../../state/TeamState";
import { RenamePlayerDialogState } from "../../state/RenamePlayerDialogState";

export function renamePlayer(): void {
    const appState: AppState = AppState.instance;
    const game: GameState = appState.game;
    const renameDialogState: RenamePlayerDialogState | undefined = appState.uiState.dialogState.renamePlayerDialog;
    if (renameDialogState == undefined) {
        return;
    }

    renameDialogState.clearErrorMessage();

    const errorMessage: string | undefined = validatePlayer();
    if (errorMessage != undefined) {
        renameDialogState.setErrorMessage(errorMessage);
        return;
    }

    const succeeded: boolean = game.tryUpdatePlayerName(
        renameDialogState.player.teamName,
        renameDialogState.player.name,
        renameDialogState.newName
    );

    if (!succeeded) {
        renameDialogState.setErrorMessage(
            "Couldn't rename the player. Make sure the name is unique on the team and try again."
        );
        return;
    }

    hideDialog();
}

export function changeNewName(newName: string): void {
    const appState: AppState = AppState.instance;
    const renamePlayerDialog: RenamePlayerDialogState | undefined = appState.uiState.dialogState.renamePlayerDialog;
    if (renamePlayerDialog == undefined) {
        return;
    }

    renamePlayerDialog.setName(newName);
}

export function validatePlayer(): string | undefined {
    const appState: AppState = AppState.instance;
    const renamePlayerDialog: RenamePlayerDialogState | undefined = appState.uiState.dialogState.renamePlayerDialog;
    if (renamePlayerDialog == undefined) {
        return "Dialog is closed";
    }

    const newPlayer: Player | undefined = new Player(
        renamePlayerDialog.newName,
        renamePlayerDialog.player.teamName,
        renamePlayerDialog.player.isStarter
    );

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
    appState.uiState.dialogState.hideRenamePlayerDialog();
}
