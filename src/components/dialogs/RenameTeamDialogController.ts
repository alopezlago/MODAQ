import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { RenameTeamDialogState } from "../../state/RenameTeamDialogState";

export function renameTeam(appState: AppState): void {
    const game: GameState = appState.game;
    const renameDialogState: RenameTeamDialogState | undefined = appState.uiState.dialogState.renameTeamDialog;
    if (renameDialogState == undefined) {
        return;
    }

    renameDialogState.clearErrorMessage();

    const errorMessage: string | undefined = validate(appState);
    if (errorMessage != undefined) {
        renameDialogState.setErrorMessage(errorMessage);
        return;
    }

    const succeeded: boolean = game.tryUpdateTeamName(renameDialogState.teamName, renameDialogState.newName);

    if (!succeeded) {
        renameDialogState.setErrorMessage("Couldn't rename the team. Make sure the name is unique and try again.");
        return;
    }

    hideDialog(appState);
}

export function changeNewName(appState: AppState, newName: string): void {
    const renameTeamDialog: RenameTeamDialogState | undefined = appState.uiState.dialogState.renameTeamDialog;
    if (renameTeamDialog == undefined) {
        return;
    }

    renameTeamDialog.setName(newName);
}

export function changeTeam(appState: AppState, teamName: string): void {
    const renameTeamDialog: RenameTeamDialogState | undefined = appState.uiState.dialogState.renameTeamDialog;
    if (renameTeamDialog == undefined) {
        return;
    }

    // Reset the new name to the team name so that it's similar
    renameTeamDialog.setTeam(teamName);
    renameTeamDialog.setName(teamName);
}

export function validate(appState: AppState): string | undefined {
    const renameTeamDialog: RenameTeamDialogState | undefined = appState.uiState.dialogState.renameTeamDialog;
    if (renameTeamDialog == undefined) {
        return "Dialog is closed";
    }

    if (renameTeamDialog.newName === renameTeamDialog.teamName) {
        // We can rename the team to itself
        return undefined;
    }

    if (renameTeamDialog.newName == undefined || renameTeamDialog.newName.trim() === "") {
        return "Name cannot be blank";
    }

    if (appState.game.teamNames.indexOf(renameTeamDialog.newName) >= 0) {
        return "Team name already exists";
    }

    return undefined;
}

export function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideRenameTeamDialog();
}
