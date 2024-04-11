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

    AppState.resetInstance();
    const appState: AppState = AppState.instance;
    appState.game = gameState;
    return { appState, players };
}

describe("ReorderTeamsDialogControllerTests", () => {
    it("submit with less than 2 doesn't break", () => {
        const { appState } = initializeApp([firstTeamPlayers[0]]);

        ReorderTeamsDialogController.submit();
        expect(appState.game.teamNames).to.be.deep.equal([defaultTeamNames[0]]);
    });
    it("submit with lonly 1 team doesn't break", () => {
        const { appState } = initializeApp([firstTeamPlayers[0], firstTeamPlayers[1]]);

        ReorderTeamsDialogController.submit();
        expect(appState.game.teamNames).to.be.deep.equal([defaultTeamNames[0]]);
    });
    it("submit with 2", () => {
        const { appState } = initializeApp([firstTeamPlayers[0], secondTeamPlayers[0]]);

        ReorderTeamsDialogController.submit();
        expect(appState.game.teamNames).to.be.deep.equal([defaultTeamNames[1], defaultTeamNames[0]]);
    });
    it("submit with several", () => {
        const { appState } = initializeApp();

        ReorderTeamsDialogController.submit();
        expect(appState.game.teamNames).to.be.deep.equal([defaultTeamNames[1], defaultTeamNames[0]]);
    });
});
