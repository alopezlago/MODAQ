import * as CustomGameFormatFormController from "../CustomizeGameFormatFormController";
import { AppState } from "../../state/AppState";
import { CustomizeGameFormatState } from "../../state/CustomizeGameFormatState";
import { GameState } from "../../state/GameState";

export function cancel(): void {
    hideDialog();
}

export function submit(): void {
    const game: GameState = AppState.instance.game;
    const state: CustomizeGameFormatState | undefined = AppState.instance.uiState.dialogState.customizeGameFormat;
    if (state == undefined) {
        throw new Error("Tried customizing a game format with no game format");
    }

    if (!CustomGameFormatFormController.isGameFormatValid(state)) {
        // We should already have the error repored, so just do nothing
        return;
    }

    CustomGameFormatFormController.normalizeGameFormat(state, game.gameFormat);

    game.setGameFormat(state.gameFormat);

    hideDialog();
}

function hideDialog(): void {
    AppState.instance.uiState.dialogState.hideCustomizeGameFormatDialog();
}
