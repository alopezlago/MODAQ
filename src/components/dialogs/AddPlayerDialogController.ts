import * as NewGameValidator from "src/state/NewGameValidator";
import { AppState } from "src/state/AppState";
import { GameState } from "src/state/GameState";
import { Player } from "src/state/TeamState";
import { UIState } from "src/state/UIState";

// TODO: Consider making AppState something we can get from a single instance (AppState.instance? AppServices.getAppState)
// This would be a type of dependency injection. Most places get it from React.useContext, and now that ModaqControl
// is the only entry point to the control, and only has a single instance of appState, it makes sense to use that
// instance everywhere

export function addPlayer(appState: AppState): void {
    const game: GameState = appState.game;
    const uiState: UIState = appState.uiState;

    if (validatePlayer(appState) != undefined) {
        return;
    }

    const newPlayer: Player | undefined = uiState.pendingNewPlayer;
    if (newPlayer == undefined) {
        throw new Error("Tried adding a player with no new player");
    }

    game.addPlayer(newPlayer);

    // TODO: Only do this if the number of active players is less than the maximum number of active players
    game.cycles[uiState.cycleIndex].addPlayerJoins(newPlayer);

    hideDialog(appState);
}

export function changePlayerName(appState: AppState, newName: string): void {
    appState.uiState.updatePendingNewPlayerName(newName);
}

export function changeTeamName(appState: AppState, teamName: string): void {
    appState.uiState.updatePendingNewPlayerName(teamName);
}

export function validatePlayer(appState: AppState): string | undefined {
    const newPlayer: Player | undefined = appState.uiState.pendingNewPlayer;
    if (newPlayer == undefined) {
        throw new Error("Tried adding a player with no new player");
    }

    // Trim the player name on submit, so the user can type in spaces while creating the name in the UI
    const trimmedPlayerName: string = newPlayer.name.trim();
    if (trimmedPlayerName.length === 0) {
        return "Player name cannot be blank";
    }

    const playersOnTeam: Player[] = [...appState.game.getPlayers(newPlayer.teamName), newPlayer];
    return NewGameValidator.newPlayerNameUnique(playersOnTeam, trimmedPlayerName);
}

export function hideDialog(appState: AppState): void {
    appState.uiState.resetPendingNewPlayer();
}
