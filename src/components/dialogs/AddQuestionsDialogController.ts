import { AddQuestionDialogState } from "../../state/AddQuestionsDialogState";
import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { PacketState } from "../../state/PacketState";

export function loadPacket(packet: PacketState): void {
    AppState.instance.uiState.dialogState.addQuestions?.setPacket(packet);
}

export function commit(): void {
    const appState: AppState = AppState.instance;
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

    hideDialog();
}

export function cancel(): void {
    AppState.instance.uiState.clearPacketStatus();
    hideDialog();
}

function hideDialog(): void {
    AppState.instance.uiState.dialogState.hideAddQuestionsDialog();
}
