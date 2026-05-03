import * as CustomGameFormatFormController from "../CustomizeGameFormatFormController";
import { AppState } from "../../state/AppState";
import { CustomizeGameFormatState } from "../../state/CustomizeGameFormatState";
import { GameState } from "../../state/GameState";

export function cancel(appState: AppState): void {
    hideDialog(appState);
}

export function submit(appState: AppState): void {
    const game: GameState = appState.game;
    const state: CustomizeGameFormatState | undefined = appState.uiState.dialogState.customizeGameFormat;
    if (state == undefined) {
        throw new Error("Tried customizing a game format with no game format");
    }

    if (!CustomGameFormatFormController.isGameFormatValid(state)) {
        // We should already have the error repored, so just do nothing
        return;
    }

    CustomGameFormatFormController.normalizeGameFormat(state, game.gameFormat);

    game.setGameFormat(state.gameFormat);

    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideCustomizeGameFormatDialog();
}
