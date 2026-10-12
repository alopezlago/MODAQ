import { expect } from "chai";

import * as ReorderTeamsDialogController from "src/components/dialogs/ReorderTeamsDialogController";
import { AppState } from "src/state/AppState";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";

const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([
    new Tossup("first q", "first a"),
    new Tossup("second q", "second a"),
    new Tossup("third q", "third a"),
]);

const defaultTeamNames: string[] = ["First Team", "Team2"];

const firstTeamPlayers: Player[] = [
    new Player("Alex", defaultTeamNames[0], true),
    new Player("Anna", defaultTeamNames[0], true),
    new Player("Ashok", defaultTeamNames[0], false),
];

const secondTeamPlayers: Player[] = [new Player("Bob", defaultTeamNames[1], true)];

const defaultExistingPlayers: Player[] = [
    firstTeamPlayers[0],
    firstTeamPlayers[1],
    firstTeamPlayers[2],
    secondTeamPlayers[0],
];

function initializeApp(players?: Player[]): { appState: AppState; players: Player[] } {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    players = players ?? defaultExistingPlayers;
    gameState.addNewPlayers(players);

    const appState: AppState = new AppState();
    appState.game = gameState;
    return { appState, players };
}

describe("ReorderTeamsDialogControllerTests", () => {
    it("submit with less than 2 doesn't break", () => {
        const { appState } = initializeApp([firstTeamPlayers[0]]);

        ReorderTeamsDialogController.submit(appState);
        expect(appState.game.teamNames).to.be.deep.equal([defaultTeamNames[0]]);
    });
    it("submit with lonly 1 team doesn't break", () => {
        const { appState } = initializeApp([firstTeamPlayers[0], firstTeamPlayers[1]]);

        ReorderTeamsDialogController.submit(appState);
        expect(appState.game.teamNames).to.be.deep.equal([defaultTeamNames[0]]);
    });
    it("submit with 2", () => {
        const { appState } = initializeApp([firstTeamPlayers[0], secondTeamPlayers[0]]);

        ReorderTeamsDialogController.submit(appState);
        expect(appState.game.teamNames).to.be.deep.equal([defaultTeamNames[1], defaultTeamNames[0]]);
    });
    it("submit with several", () => {
        const { appState } = initializeApp();

        ReorderTeamsDialogController.submit(appState);
        expect(appState.game.teamNames).to.be.deep.equal([defaultTeamNames[1], defaultTeamNames[0]]);
    });
    it("orders more than two teams as chosen, keeping each team's players in their order", () => {
        const c: Player[] = [new Player("Cy", "Third", true), new Player("Cal", "Third", true)];
        const { appState } = initializeApp([...defaultExistingPlayers, ...c]);

        appState.uiState.dialogState.showReorderTeamsDialog(appState.game.teamNames);
        ReorderTeamsDialogController.moveTeam(appState, 2, -1);
        ReorderTeamsDialogController.moveTeam(appState, 1, -1);
        ReorderTeamsDialogController.submitOrder(appState);

        expect(appState.game.teamNames).to.be.deep.equal(["Third", defaultTeamNames[0], defaultTeamNames[1]]);
        expect(appState.game.players.map((p) => p.name)).to.be.deep.equal(["Cy", "Cal", "Alex", "Anna", "Ashok", "Bob"]);
        expect(appState.uiState.dialogState.reorderTeamsDialog).to.be.undefined;
    });
    it("a move past either end does nothing", () => {
        const c: Player[] = [new Player("Cy", "Third", true)];
        const { appState } = initializeApp([...defaultExistingPlayers, ...c]);

        appState.uiState.dialogState.showReorderTeamsDialog(appState.game.teamNames);
        ReorderTeamsDialogController.moveTeam(appState, 0, -1);
        ReorderTeamsDialogController.moveTeam(appState, 2, 1);
        expect(appState.uiState.dialogState.reorderTeamsDialog?.teamNames).to.be.deep.equal([defaultTeamNames[0], defaultTeamNames[1], "Third"]);
    });
});
