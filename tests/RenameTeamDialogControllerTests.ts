import { assert, expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import * as RenameTeamDialogController from "src/components/dialogs/RenameTeamDialogController";
import { AppState } from "src/state/AppState";
import {
    IBonusProtestEvent,
    IPlayerJoinsEvent,
    IPlayerLeavesEvent,
    ISubstitutionEvent,
    ITossupAnswerEvent,
    ITossupProtestEvent,
} from "src/state/Events";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup } from "src/state/PacketState";
import { RenameTeamDialogState } from "src/state/RenameTeamDialogState";
import { Player } from "src/state/TeamState";

const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([
    new Tossup("first q", "first a"),
    new Tossup("second q", "second a"),
    new Tossup("third q", "third a"),
    new Tossup("fourth q", "fourth a"),
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

function initializeApp(): AppState {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    const players: Player[] = createDefaultExistingPlayers();
    gameState.addNewPlayers(players);

    AppState.resetInstance();
    const appState: AppState = AppState.instance;
    appState.game = gameState;
    appState.uiState.dialogState.showRenameTeamDialog(players[0].teamName);
    return appState;
}

function getRenameTeamDialogState(appState: AppState): RenameTeamDialogState {
    if (appState.uiState.dialogState.renameTeamDialog == undefined) {
        assert.fail("RenameTeamDialog should not be undefined");
    }

    return appState.uiState.dialogState.renameTeamDialog;
}

describe("RenameTeamDialogControllerTests", () => {
    it("changeNewName", () => {
        const name = "New team name";
        const appState: AppState = initializeApp();
        RenameTeamDialogController.changeNewName(name);
        const state: RenameTeamDialogState = getRenameTeamDialogState(appState);

        expect(state.newName).to.equal(name);
        expect(state.teamName).to.equal(defaultTeamNames[0]);
        expect(state.errorMessage).to.be.undefined;
    });
    it("hideDialog", () => {
        const appState: AppState = initializeApp();
        RenameTeamDialogController.hideDialog();

        expect(appState.uiState.dialogState.renameTeamDialog).to.be.undefined;
    });
    describe("validate", () => {
        it("validate - non-empty name", () => {
            initializeApp();
            RenameTeamDialogController.changeNewName(" ");
            const errorMessage: string | undefined = RenameTeamDialogController.validate();
            expect(errorMessage).to.not.be.undefined;
        });
        it("validate - duplicate name", () => {
            initializeApp();
            RenameTeamDialogController.changeNewName(defaultTeamNames[1]);
            const errorMessage: string | undefined = RenameTeamDialogController.validate();
            expect(errorMessage).to.not.be.undefined;
        });
        it("validate - new name", () => {
            initializeApp();
            RenameTeamDialogController.changeNewName("Newbie");
            const errorMessage: string | undefined = RenameTeamDialogController.validate();
            expect(errorMessage).to.be.undefined;
        });
    });
    describe("renameTeam", () => {
        it("renameTeam succeeds", () => {
            const name = "New Team";
            const appState: AppState = initializeApp();
            const player: Player = appState.game.players[0];

            appState.game.cycles[0].addWrongBuzz(
                {
                    player: player,
                    points: -5,
                    position: 10,
                },
                0,
                GameFormats.UndefinedGameFormat
            );

            appState.game.cycles[0].addTossupProtest(player.teamName, 0, 10, "Some answer", "It was right");

            appState.game.cycles[1].addCorrectBuzz(
                {
                    player: player,
                    points: 15,
                    position: 11,
                },
                0,
                GameFormats.UndefinedGameFormat,
                0,
                3
            );

            appState.game.cycles[1].addBonusProtest(0, 2, "Bonus answer", "That should've been right", player.teamName);

            appState.game.cycles[1].timeouts = [
                {
                    teamName: defaultTeamNames[0],
                },
            ];

            appState.game.cycles[2].addPlayerLeaves(player);

            const newPlayer: Player = new Player("Avery", defaultTeamNames[0], false);
            appState.game.cycles[2].addPlayerJoins(newPlayer);

            appState.game.cycles[3].addSwapSubstitution(player, newPlayer);

            RenameTeamDialogController.changeNewName(name);
            RenameTeamDialogController.renameTeam();

            // Verify - dialog hidden, player is in game, add player event in cycle
            expect(appState.uiState.dialogState.renameTeamDialog).to.be.undefined;

            expect(appState.game.teamNames[0]).to.equal(name);
            expect(appState.game.teamNames[1]).to.equal(defaultTeamNames[1]);

            const wrongBuzzes: ITossupAnswerEvent[] | undefined = appState.game.cycles[0].wrongBuzzes;
            if (wrongBuzzes === undefined) {
                assert.fail("Expected wrongBuzzes event in the first cycle");
            }

            expect(wrongBuzzes.length).to.equal(1);
            expect(wrongBuzzes[0].marker.player.name).to.equal(player.name);
            expect(wrongBuzzes[0].marker.player.teamName).to.equal(name);

            const tossupProtests: ITossupProtestEvent[] | undefined = appState.game.cycles[0].tossupProtests;
            if (tossupProtests === undefined) {
                assert.fail("Expected tossupProtests event in the first cycle");
            }

            expect(tossupProtests.length).to.equal(1);
            expect(tossupProtests[0].teamName).to.equal(name);

            const correctBuzz: ITossupAnswerEvent | undefined = appState.game.cycles[1].correctBuzz;
            if (correctBuzz === undefined) {
                assert.fail("Expected correctBuzz event in the second cycle");
            }

            expect(correctBuzz.marker.player.name).to.equal(player.name);
            expect(correctBuzz.marker.player.teamName).to.equal(name);

            const bonusProtests: IBonusProtestEvent[] | undefined = appState.game.cycles[1].bonusProtests;
            if (bonusProtests === undefined) {
                assert.fail("Expected bonusProtests event in the second cycle");
            }

            expect(bonusProtests.length).to.equal(1);
            expect(bonusProtests[0].teamName).to.equal(name);

            const thirdCycle = appState.game.cycles[2];
            const playerLeaves: IPlayerLeavesEvent[] | undefined = thirdCycle.playerLeaves;
            if (playerLeaves === undefined) {
                assert.fail("Expected playerLeaves event in the third cycle");
            }

            expect(playerLeaves.length).to.equal(1);
            expect(playerLeaves[0].outPlayer.name).to.equal(player.name);
            expect(playerLeaves[0].outPlayer.teamName).to.equal(name);

            const playerJoins: IPlayerJoinsEvent[] | undefined = thirdCycle.playerJoins;
            if (playerJoins === undefined) {
                assert.fail("Expected playerLeaves event in the third cycle");
            }

            expect(playerJoins.length).to.equal(1);
            expect(playerJoins[0].inPlayer.name).to.equal(newPlayer.name);
            expect(playerJoins[0].inPlayer.teamName).to.equal(name);

            const subs: ISubstitutionEvent[] | undefined = appState.game.cycles[3].subs;
            if (subs === undefined) {
                assert.fail("Expected substitution event in the fourth cycle");
            }

            expect(subs.length).to.equal(1);

            const sub: ISubstitutionEvent = subs[0];
            expect(sub.inPlayer.name).to.equal(player.name);
            expect(sub.inPlayer.teamName).to.equal(name);
            expect(sub.outPlayer.name).to.equal(newPlayer.name);
            expect(sub.outPlayer.teamName).to.equal(name);
        });
        it("renameTeam fails (empty name)", () => {
            const appState: AppState = initializeApp();
            RenameTeamDialogController.changeNewName(" ");
            RenameTeamDialogController.renameTeam();

            const state: RenameTeamDialogState = getRenameTeamDialogState(appState);
            expect(state.errorMessage).to.not.be.undefined;
            expect(appState.game.teamNames[0]).to.equal(defaultTeamNames[0]);
            expect(appState.game.teamNames[1]).to.equal(defaultTeamNames[1]);
        });
        it("renameTeam fails (other team name)", () => {
            const appState: AppState = initializeApp();
            RenameTeamDialogController.changeNewName(defaultTeamNames[1]);
            RenameTeamDialogController.renameTeam();

            const state: RenameTeamDialogState = getRenameTeamDialogState(appState);
            expect(state.errorMessage).to.not.be.undefined;
            expect(appState.game.teamNames[0]).to.equal(defaultTeamNames[0]);
            expect(appState.game.teamNames[1]).to.equal(defaultTeamNames[1]);
        });
        it("renameTeam succeeds (same team name)", () => {
            const appState: AppState = initializeApp();
            RenameTeamDialogController.changeNewName(defaultTeamNames[0]);
            RenameTeamDialogController.renameTeam();

            expect(appState.uiState.dialogState.renameTeamDialog).to.be.undefined;

            const oldTeamNameIndex: number = appState.game.teamNames.indexOf(defaultTeamNames[0]);
            expect(oldTeamNameIndex).to.equal(0);
        });
    });
});
