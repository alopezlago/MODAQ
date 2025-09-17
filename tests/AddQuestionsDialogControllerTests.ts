import { assert, expect } from "chai";

import * as AddQuestionsDialogController from "src/components/dialogs/AddQuestionsDialogController";
import { AddQuestionDialogState } from "src/state/AddQuestionsDialogState";
import { AppState } from "src/state/AppState";
import { GameState } from "src/state/GameState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";

const defaultPacketName = "Default";
const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([new Tossup("first q", "first a"), new Tossup("second q", "second a")]);
defaultPacket.setBonuses([new Bonus("Leadin", [])]);
defaultPacket.setName(defaultPacketName);

const newPacket: PacketState = new PacketState();
newPacket.setTossups([new Tossup("third q", "third a")]);
newPacket.setBonuses([new Bonus("Leadin 2", []), new Bonus("Leadin 3", [])]);
newPacket.setName("NewPacket");

const defaultTeamNames: string[] = ["First Team", "Team2"];

function initializeApp(): AppState {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    const defaultExistingPlayers: Player[] = [
        new Player("Frank", defaultTeamNames[0], true),
        new Player("Faye", defaultTeamNames[0], true),
        new Player("Saul", defaultTeamNames[1], true),
    ];
    gameState.addNewPlayers(defaultExistingPlayers);

    AppState.resetInstance();
    const appState: AppState = AppState.instance;
    appState.game = gameState;
    appState.uiState.dialogState.showAddQuestionsDialog();
    return appState;
}

describe("AddQuestoinsDialogControllerTests", () => {
    it("loadPacket", () => {
        const appState: AppState = initializeApp();
        AddQuestionsDialogController.loadPacket(newPacket);

        const dialogState: AddQuestionDialogState | undefined = appState.uiState.dialogState.addQuestions;
        if (dialogState == undefined) {
            assert.fail("Add Questions dialog state isn't defined");
        }

        const gameState: GameState = appState.game;
        expect(gameState.packet).to.not.be.undefined;
        expect(gameState.packet.tossups.length).to.equal(2);
        expect(gameState.packet.bonuses.length).to.equal(1);
        expect(gameState.packet.name).to.equal(defaultPacketName);
        expect(dialogState.newPacket).to.not.be.undefined;
        expect(dialogState.newPacket.tossups.length).to.equal(1);
        expect(dialogState.newPacket.bonuses.length).to.equal(2);

        AddQuestionsDialogController.commit();

        expect(gameState.packet).to.not.be.undefined;
        expect(gameState.packet.tossups.length).to.equal(3);
        expect(gameState.packet.bonuses.length).to.equal(3);
        expect(gameState.packet.name).to.equal(defaultPacketName);
        expect(appState.uiState.dialogState.addQuestions).to.be.undefined;
    });

    it("hideDialog", () => {
        const appState: AppState = initializeApp();
        expect(appState.uiState.dialogState.addQuestions).to.not.be.undefined;

        AddQuestionsDialogController.cancel();

        expect(appState.uiState.dialogState.addQuestions).to.be.undefined;
    });
});
