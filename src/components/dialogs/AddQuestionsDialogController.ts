import { AddQuestionDialogState } from "../../state/AddQuestionsDialogState";
import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { PacketState } from "../../state/PacketState";

export function loadPacket(appState: AppState, packet: PacketState): void {
    appState.uiState.dialogState.addQuestions?.setPacket(packet);
}

export function commit(appState: AppState): void {
    const game: GameState = appState.game;
    const state: AddQuestionDialogState | undefined = appState.uiState.dialogState.addQuestions;
    if (state == undefined) {
        throw new Error("Tried adding more questions without any questions");
    }

    const combinedPacket: PacketState = new PacketState();
    combinedPacket.setTossups(game.packet.tossups.concat(state.newPacket.tossups));
    combinedPacket.setBonuses(game.packet.bonuses.concat(state.newPacket.bonuses));
    combinedPacket.setName(game.packet.name);
    game.loadPacket(combinedPacket);

    hideDialog(appState);
}

export function cancel(appState: AppState): void {
    appState.uiState.clearPacketStatus();
    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideAddQuestionsDialog();
}
