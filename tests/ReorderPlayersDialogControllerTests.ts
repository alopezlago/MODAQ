import { assert, expect } from "chai";

import * as ReorderPlayersDialogController from "src/components/dialogs/ReorderPlayersDialogController";
import { AppState } from "src/state/AppState";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";
import { ReorderPlayersDialogState } from "src/state/ReorderPlayersDialogState";

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

const secondTeamPlayers: Player[] = [
    new Player("Bob", defaultTeamNames[1], true),
    new Player("Anna", defaultTeamNames[1], true),
];

const defaultExistingPlayers: Player[] = [
    firstTeamPlayers[0],
    firstTeamPlayers[1],
    secondTeamPlayers[0],
    secondTeamPlayers[1],
    firstTeamPlayers[2],
];

function initializeApp(players?: Player[]): { appState: AppState; players: Player[] } {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    players = players ?? defaultExistingPlayers;
    gameState.addNewPlayers(players);

    const appState: AppState = new AppState();
    appState.game = gameState;
    appState.uiState.dialogState.showReorderPlayersDialog(players);
    return { appState, players };
}

function getReorderPlayersDialogState(appState: AppState): ReorderPlayersDialogState {
    if (appState.uiState.dialogState.reorderPlayersDialog == undefined) {
        assert.fail("PendingNewPlayer should not be undefined");
    }

    return appState.uiState.dialogState.reorderPlayersDialog;
}

describe("ReorderPlayersDialogControllerTests", () => {
    it("hideDialog", () => {
        const { appState } = initializeApp();
        ReorderPlayersDialogController.hideDialog(appState);

        expect(appState.uiState.dialogState.reorderPlayersDialog).to.be.undefined;
    });
    describe("changeTeamName", () => {
        it("change to both teams", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.changeTeamName(appState, defaultTeamNames[1]);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.teamName).to.equal(defaultTeamNames[1]);
            ReorderPlayersDialogController.changeTeamName(appState, defaultTeamNames[0]);
            expect(dialog.teamName).to.equal(defaultTeamNames[0]);
        });
    });
    it("submit", () => {
        const { appState, players } = initializeApp();
        const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);
        dialog.movePlayerBackward(players[0]);

        ReorderPlayersDialogController.submit(appState);

        expect(appState.uiState.dialogState.reorderPlayersDialog).to.be.undefined;
        expect(appState.game.players).to.be.deep.equal([
            firstTeamPlayers[1],
            firstTeamPlayers[0],
            secondTeamPlayers[0],
            secondTeamPlayers[1],
            firstTeamPlayers[2],
        ]);
    });
    describe("moveBackward", () => {
        it("Move backwards from the end is no-op", () => {
            const { appState, players } = initializeApp();
            ReorderPlayersDialogController.moveBackward(appState, players[players.length - 1]);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players[players.length - 1]).to.equal(players[players.length - 1]);
            expect(dialog.players).to.be.deep.equal(players);
        });
        it("Move backwards from front moves player back", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.moveBackward(appState, firstTeamPlayers[0]);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players[0]).to.equal(firstTeamPlayers[1]);
            expect(dialog.players[1]).to.equal(firstTeamPlayers[0]);
            expect(dialog.players.slice(2)).to.be.deep.equal(defaultExistingPlayers.slice(2));
        });
        it("Move backwards for second team", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.moveBackward(appState, secondTeamPlayers[0]);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players).to.be.deep.equal([
                firstTeamPlayers[0],
                firstTeamPlayers[1],
                secondTeamPlayers[1],
                secondTeamPlayers[0],
                firstTeamPlayers[2],
            ]);
        });
        it("Move backwards with gap swaps correctly", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.moveBackward(appState, firstTeamPlayers[1]);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players).to.be.deep.equal([
                firstTeamPlayers[0],
                firstTeamPlayers[2],
                secondTeamPlayers[0],
                secondTeamPlayers[1],
                firstTeamPlayers[1],
            ]);
        });
    });
    describe("moveForward", () => {
        it("Move forwards from 0 is no-op", () => {
            const { appState, players } = initializeApp();
            ReorderPlayersDialogController.moveForward(appState, players[0]);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players[0]).to.equal(players[0]);
            expect(dialog.players).to.be.deep.equal(players);
        });
        it("Move forwards from 1 swaps player to front", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.moveForward(appState, firstTeamPlayers[1]);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players[0]).to.equal(firstTeamPlayers[1]);
            expect(dialog.players[1]).to.equal(firstTeamPlayers[0]);
            expect(dialog.players.slice(2)).to.be.deep.equal(defaultExistingPlayers.slice(2));
        });
        it("Move forwards for second team", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.moveForward(appState, secondTeamPlayers[1]);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players).to.be.deep.equal([
                firstTeamPlayers[0],
                firstTeamPlayers[1],
                secondTeamPlayers[1],
                secondTeamPlayers[0],
                firstTeamPlayers[2],
            ]);
        });
        it("Move forwards with gap swaps correctly", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.moveForward(appState, firstTeamPlayers[2]);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players).to.be.deep.equal([
                firstTeamPlayers[0],
                firstTeamPlayers[2],
                secondTeamPlayers[0],
                secondTeamPlayers[1],
                firstTeamPlayers[1],
            ]);
        });
    });

    // move ToIndex tests
    describe("movePlayerToIndex", () => {
        it("movePlayerToIndex to same index is no-op", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.movePlayerToIndex(appState, firstTeamPlayers[1], 1);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players).to.be.deep.equal(defaultExistingPlayers);
        });
        it("movePlayerToIndex to negative index is no-op", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.movePlayerToIndex(appState, firstTeamPlayers[1], -1);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players).to.be.deep.equal(defaultExistingPlayers);
        });
        it("movePlayerToIndex to overly large index is no-op", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.movePlayerToIndex(appState, firstTeamPlayers[1], firstTeamPlayers.length);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players).to.be.deep.equal(defaultExistingPlayers);
        });
        it("movePlayerToIndex next player swap", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.movePlayerToIndex(appState, firstTeamPlayers[0], 1);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players[0]).to.equal(firstTeamPlayers[1]);
            expect(dialog.players[1]).to.equal(firstTeamPlayers[0]);
            expect(dialog.players.slice(2)).to.be.deep.equal(defaultExistingPlayers.slice(2));
        });
        it("movePlayerToIndex first to last player swap", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.movePlayerToIndex(appState, firstTeamPlayers[0], 2);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players).to.be.deep.equal([
                firstTeamPlayers[1],
                secondTeamPlayers[0],
                secondTeamPlayers[1],
                firstTeamPlayers[2],
                firstTeamPlayers[0],
            ]);
        });
        it("movePlayerToIndex last to first player swap", () => {
            const { appState } = initializeApp();
            ReorderPlayersDialogController.movePlayerToIndex(appState, firstTeamPlayers[2], 0);
            const dialog: ReorderPlayersDialogState = getReorderPlayersDialogState(appState);

            expect(dialog.players).to.be.deep.equal([
                firstTeamPlayers[2],
                firstTeamPlayers[0],
                firstTeamPlayers[1],
                secondTeamPlayers[0],
                secondTeamPlayers[1],
            ]);
        });
    });
});
