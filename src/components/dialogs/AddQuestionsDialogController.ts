import * as PacketLoaderController from "../PacketLoaderController";
import { AddQuestionDialogState } from "../../state/AddQuestionsDialogState";
import { AppState } from "../../state/AppState";
import { GameState } from "../../state/GameState";
import { IPacket } from "../../state/IPacket";
import { PacketState } from "../../state/PacketState";
import { IStatus } from "../../IStatus";

export function loadPacket(appState: AppState, packet: PacketState): void {
    appState.uiState.dialogState.addQuestions?.setPacket(packet);
}

// Calls the host-provided onFetchQuestionById callback (TMS owns the actual storage lookup; MODAQ only knows how to
// turn the resulting IPacket JSON into a PacketState, reusing the same logic as the regular packet loader).
export async function loadById(appState: AppState, questionId: string): Promise<void> {
    const uiState = appState.uiState;
    const onFetchQuestionById = uiState.onFetchQuestionById;
    if (onFetchQuestionById == undefined) {
        uiState.setPacketStatus({ isError: true, status: "No question lookup is configured." });
        return;
    }

    uiState.setPacketStatus({ isError: false, status: "Looking up question..." });

    let result: IPacket | IStatus;
    try {
        result = await onFetchQuestionById(questionId);
    } catch (e) {
        uiState.setPacketStatus({ isError: true, status: `Error looking up question: ${e}` });
        return;
    }

    if (!isPacket(result)) {
        uiState.setPacketStatus(result);
        return;
    }

    const packet: PacketState | undefined = PacketLoaderController.loadPacket(appState, result);
    if (packet == undefined) {
        return;
    }

    loadPacket(appState, packet);
    uiState.setPacketStatus({
        isError: false,
        status: `Loaded ${packet.tossups.length} tossup(s) and ${packet.bonuses.length} bonus(es). Click Confirm to merge into the game.`,
    });
}

function isPacket(result: IPacket | IStatus): result is IPacket {
    return (result as IPacket).tossups != undefined;
}

export function commit(appState: AppState): void {
    mergeNewPacketIntoGame(appState);
    hideDialog(appState);
}

function mergeNewPacketIntoGame(appState: AppState): void {
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

    state.setPacket(new PacketState());
}

export function cancel(appState: AppState): void {
    appState.uiState.clearPacketStatus();
    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideAddQuestionsDialog();
}
