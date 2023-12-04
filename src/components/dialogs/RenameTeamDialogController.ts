import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { RenameTeamDialogState } from "../../state/RenameTeamDialogState";

export function renameTeam(): void {
    const appState: AppState = AppState.instance;
    const game: GameState = appState.game;
    const renameDialogState: RenameTeamDialogState | undefined = appState.uiState.dialogState.renameTeamDialog;
    if (renameDialogState == undefined) {
        return;
    }

    renameDialogState.clearErrorMessage();

    const errorMessage: string | undefined = validate();
    if (errorMessage != undefined) {
        renameDialogState.setErrorMessage(errorMessage);
        return;
    }

    const succeeded: boolean = game.tryUpdateTeamName(renameDialogState.teamName, renameDialogState.newName);

    if (!succeeded) {
        renameDialogState.setErrorMessage("Couldn't rename the team. Make sure the name is unique and try again.");
        return;
    }

    hideDialog();
}

export function changeNewName(newName: string): void {
    const appState: AppState = AppState.instance;
    const renameTeamDialog: RenameTeamDialogState | undefined = appState.uiState.dialogState.renameTeamDialog;
    if (renameTeamDialog == undefined) {
        return;
    }

    renameTeamDialog.setName(newName);
}

export function changeTeam(teamName: string): void {
    const appState: AppState = AppState.instance;
    const renameTeamDialog: RenameTeamDialogState | undefined = appState.uiState.dialogState.renameTeamDialog;
    if (renameTeamDialog == undefined) {
        return;
    }

    // Reset the new name to the team name so that it's similar
    renameTeamDialog.setTeam(teamName);
    renameTeamDialog.setName(teamName);
}

export function validate(): string | undefined {
    const appState: AppState = AppState.instance;
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

export function hideDialog(): void {
    const appState: AppState = AppState.instance;
    appState.uiState.dialogState.hideRenameTeamDialog();
}
