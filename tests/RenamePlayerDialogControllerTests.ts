import { assert, expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import * as RenamePlayerDialogController from "src/components/dialogs/RenamePlayerDialogController";
import { AppState } from "src/state/AppState";
import { IPlayerJoinsEvent, IPlayerLeavesEvent, ISubstitutionEvent, ITossupAnswerEvent } from "src/state/Events";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup } from "src/state/PacketState";
import { RenamePlayerDialogState } from "src/state/RenamePlayerDialogState";
import { Player } from "src/state/TeamState";

const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([
    new Tossup("first q", "first a"),
    new Tossup("second q", "second a"),
    new Tossup("third q", "third a"),
]);

const defaultTeamNames: string[] = ["First Team", "Team2"];

function createDefaultExistingPlayers(): Player[] {
    return [
        new Player("Alex", defaultTeamNames[0], true),
        new Player("Anna", defaultTeamNames[0], true),
        new Player("Bob", defaultTeamNames[1], true),
        new Player("Anna", defaultTeamNames[1], true),
        new Player("Ashok", defaultTeamNames[0], false),
    ];
}

function initializeApp(player: Player | undefined = undefined): { appState: AppState; players: Player[] } {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    const players: Player[] = createDefaultExistingPlayers();
    gameState.addPlayers(players);

    if (player == undefined) {
        player = players[0];
    }

    AppState.resetInstance();
    const appState: AppState = AppState.instance;
    appState.game = gameState;
    appState.uiState.dialogState.showRenamePlayerDialog(player);
    return { appState, players };
}

function getRenamePlayerDialogState(appState: AppState): RenamePlayerDialogState {
    if (appState.uiState.dialogState.renamePlayerDialog == undefined) {
        assert.fail("PendingNewPlayer should not be undefined");
    }

    return appState.uiState.dialogState.renamePlayerDialog;
}

describe("RenamePlayerDialogControllerTests", () => {
    it("changeNewName", () => {
        const name = "New player name";
        const { appState, players } = initializeApp();
        RenamePlayerDialogController.changeNewName(name);
        const state: RenamePlayerDialogState = getRenamePlayerDialogState(appState);

        expect(state.newName).to.equal(name);
        expect(state.player.name).to.equal(players[0].name);
        expect(state.errorMessage).to.be.undefined;
    });
    it("hideDialog", () => {
        const { appState } = initializeApp();
        RenamePlayerDialogController.hideDialog();

        expect(appState.uiState.dialogState.renamePlayerDialog).to.be.undefined;
    });
    describe("validatePlayer", () => {
        it("validatePlayer - non-empty name", () => {
            initializeApp();
            RenamePlayerDialogController.changeNewName(" ");
            const errorMessage: string | undefined = RenamePlayerDialogController.validatePlayer();
            expect(errorMessage).to.not.be.undefined;
        });
        it("validatePlayer - duplicate name", () => {
            const { players } = initializeApp();
            RenamePlayerDialogController.changeNewName(players[1].name);
            const errorMessage: string | undefined = RenamePlayerDialogController.validatePlayer();
            expect(errorMessage).to.not.be.undefined;
        });
        it("validatePlayer - new name", () => {
            initializeApp();
            RenamePlayerDialogController.changeNewName("Newbie");
            const errorMessage: string | undefined = RenamePlayerDialogController.validatePlayer();
            expect(errorMessage).to.be.undefined;
        });
        it("validatePlayer - new name from other team", () => {
            const { players } = initializeApp();
            RenamePlayerDialogController.changeNewName(players[2].name);
            const errorMessage: string | undefined = RenamePlayerDialogController.validatePlayer();
            expect(errorMessage).to.be.undefined;
        });
    });
    describe("renamePlayer", () => {
        // TODO: Need one for different player instance
        // Need to test correct buzz, sub, and joins
        function renamePlayerSucceeds(useCopy: boolean): void {
            const name = "Carol";
            const playerToRename: Player | undefined = useCopy
                ? new Player("Alex", defaultTeamNames[0], true)
                : undefined;
            const { appState, players } = initializeApp(playerToRename);
            const originalPlayer = players[0];
            const originalName: string = originalPlayer.name;

            appState.game.cycles[0].addWrongBuzz(
                {
                    player: originalPlayer,
                    points: -5,
                    position: 10,
                },
                0,
                GameFormats.UndefinedGameFormat
            );

            appState.game.cycles[1].addCorrectBuzz(
                {
                    player: originalPlayer,
                    points: 15,
                    position: 11,
                },
                0,
                GameFormats.UndefinedGameFormat,
                0,
                3
            );

            appState.game.cycles[2].addPlayerLeaves(originalPlayer);

            RenamePlayerDialogController.changeNewName(name);
            RenamePlayerDialogController.renamePlayer();

            // Verify - dialog hidden, player is in game, add player event in cycle
            expect(appState.uiState.dialogState.renamePlayerDialog).to.be.undefined;

            const newPlayer: Player | undefined = appState.game.players.find(
                (player) => player.name === name && player.teamName === defaultTeamNames[0]
            );
            if (newPlayer == undefined) {
                assert.fail(`Couldn't find new player in players: ${JSON.stringify(appState.game.players)}`);
            }

            const oldPlayer: Player | undefined = appState.game.players.find(
                (player) => player.name === originalName && player.teamName === defaultTeamNames[0]
            );
            expect(oldPlayer).to.be.undefined;

            const wrongBuzzes: ITossupAnswerEvent[] | undefined = appState.game.cycles[0].wrongBuzzes;
            if (wrongBuzzes === undefined) {
                assert.fail("Expected wrongBuzzes event in the first cycle");
            }

            expect(wrongBuzzes.length).to.equal(1);
            expect(wrongBuzzes[0].marker.player.name).to.equal(name);
            expect(wrongBuzzes[0].marker.player.teamName).to.equal(originalPlayer.teamName);

            const correctBuzz: ITossupAnswerEvent | undefined = appState.game.cycles[1].correctBuzz;
            if (correctBuzz === undefined) {
                assert.fail("Expected correctBuzz event in the second cycle");
            }

            expect(correctBuzz.marker.player.name).to.equal(name);
            expect(correctBuzz.marker.player.teamName).to.equal(originalPlayer.teamName);

            const secondCycle = appState.game.cycles[2];
            const playerLeaves: IPlayerLeavesEvent[] | undefined = secondCycle.playerLeaves;
            if (playerLeaves === undefined) {
                assert.fail("Expected playerLeaves event in the third cycle");
            }

            expect(playerLeaves.length).to.equal(1);
            expect(playerLeaves[0].outPlayer.name).to.equal(name);
            expect(playerLeaves[0].outPlayer.teamName).to.equal(originalPlayer.teamName);
        }

        it("renamePlayer succeeds (same player)", () => {
            renamePlayerSucceeds(false);
        });
        it("renamePlayer succeeds (copy of player)", () => {
            renamePlayerSucceeds(true);
        });
        it("renamePlayer succeeds for join and sub", () => {
            const name = "Arthur";
            const gameState: GameState = new GameState();
            gameState.loadPacket(defaultPacket);

            const players: Player[] = createDefaultExistingPlayers();
            gameState.addPlayers(players);

            AppState.resetInstance();
            const appState: AppState = AppState.instance;
            appState.game = gameState;

            const originalPlayer: Player = new Player("Arty", defaultTeamNames[0], false);
            gameState.addPlayer(originalPlayer);
            gameState.cycles[1].addPlayerJoins(originalPlayer);
            gameState.cycles[2].addSwapSubstitution(players[players.length - 1], originalPlayer);

            appState.uiState.dialogState.showRenamePlayerDialog(originalPlayer);

            const state: RenamePlayerDialogState = getRenamePlayerDialogState(appState);
            RenamePlayerDialogController.changeNewName(name);
            RenamePlayerDialogController.renamePlayer();

            expect(appState.uiState.dialogState.renamePlayerDialog).to.be.undefined;

            const playerJoins: IPlayerJoinsEvent[] | undefined = gameState.cycles[1].playerJoins;
            if (playerJoins === undefined) {
                assert.fail("Expected sub event in the second cycle");
            }

            expect(playerJoins.length).to.equal(1);
            expect(playerJoins[0].inPlayer.name).to.equal(name);
            expect(playerJoins[0].inPlayer.teamName).to.equal(originalPlayer.teamName);

            const subs: ISubstitutionEvent[] | undefined = gameState.cycles[2].subs;
            if (subs === undefined) {
                assert.fail("Expected sub event in the third cycle");
            }

            expect(subs.length).to.equal(1);
            expect(subs[0].outPlayer.name).to.equal(name);
            expect(subs[0].outPlayer.teamName).to.equal(originalPlayer.teamName);
        });
        it("renamePlayer fails (empty name)", () => {
            const { appState } = initializeApp();
            RenamePlayerDialogController.changeNewName(" ");
            RenamePlayerDialogController.renamePlayer();

            const state: RenamePlayerDialogState = getRenamePlayerDialogState(appState);
            expect(state.errorMessage).to.not.be.undefined;

            const newPlayer: Player | undefined = appState.game.players.find(
                (player) => player.name === " " && player.teamName === defaultTeamNames[0]
            );
            expect(newPlayer).to.be.undefined;
        });
    });
});
