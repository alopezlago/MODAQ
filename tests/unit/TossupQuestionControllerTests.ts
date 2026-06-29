import { assert, expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import * as TossupQuestionController from "src/components/TossupQuestionController";
import { Player } from "src/state/TeamState";
import { PacketState, Tossup } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";
import { AppState } from "src/state/AppState";

describe("TossupQuestionControllerTests", () => {
    describe("getWordsForReaderFollower", () => {
        it("Excludes power markers, pronunciation guides, and the end marker", () => {
            const tossup: Tossup = new Tossup(
                'This scientist ("SY-en-tist") did things (*) for ten points, name them',
                "Answer"
            );

            const words: string[] = TossupQuestionController.getWordsForReaderFollower(
                tossup,
                GameFormats.StandardPowersMACFGameFormat
            );

            expect(words).to.not.contain("(*)");
            expect(words[0]).to.equal("This");
            expect(words[1]).to.equal("scientist");
            expect(words[2]).to.equal("did");
            expect(words[words.length - 1]).to.equal("them");
        });
        it("Word positions match buzzable word indexes", () => {
            const tossup: Tossup = new Tossup("First second (*) third fourth", "Answer");
            const words: string[] = TossupQuestionController.getWordsForReaderFollower(
                tossup,
                GameFormats.StandardPowersMACFGameFormat
            );

            // The power marker isn't buzzable, so "third" should be at word index 2
            expect(words).to.deep.equal(["First", "second", "third", "fourth"]);
        });
    });

    describe("openBuzzMenuAtBuzzPoint", () => {
        function createAppStateWithPacket(): AppState {
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([new Tossup("This is the first question", "Answer")]);
            appState.game.loadPacket(packet);
            return appState;
        }

        it("Anchors to the live reading position when the mouse hasn't been on the text", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(3);

            TossupQuestionController.openBuzzMenuAtBuzzPoint(appState, /* now */ 1000000);

            expect(appState.uiState.selectedWordIndex).to.equal(3);
            expect(appState.uiState.buzzMenuState.visible).to.be.true;
        });
        it("Keeps the selection when the mouse was recently on the text", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(3);
            appState.uiState.setSelectedWordIndex(1);

            const now = 1000000;
            appState.uiState.setLastQuestionTextMouseMoveTime(now - 500);
            TossupQuestionController.openBuzzMenuAtBuzzPoint(appState, now);

            expect(appState.uiState.selectedWordIndex).to.equal(1);
            expect(appState.uiState.buzzMenuState.visible).to.be.true;
        });
        it("Falls back to the end of the question with no reading position or selection", () => {
            const appState: AppState = createAppStateWithPacket();

            TossupQuestionController.openBuzzMenuAtBuzzPoint(appState, /* now */ 1000000);

            // "This is the first question" plus the end-of-question marker; the last buzzable index is 5
            expect(appState.uiState.selectedWordIndex).to.equal(5);
            expect(appState.uiState.buzzMenuState.visible).to.be.true;
        });
    });

    describe("buzz menu keyboard selection", () => {
        function createAppStateWithPacket(): AppState {
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([new Tossup("This is the first question", "Answer")]);
            appState.game.loadPacket(packet);
            return appState;
        }

        it("Players are ordered by team then player", () => {
            const appState: AppState = createAppStateWithPacket();
            const players: Player[] = TossupQuestionController.getBuzzMenuOrderedPlayers(appState);
            expect(players.map((player) => player.name)).to.deep.equal(["Alice", "Bob"]);
        });
        it("Number key selects the player", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);

            TossupQuestionController.selectBuzzMenuPlayerByNumber(appState, 2);
            expect(appState.uiState.buzzMenuState.selectedPlayerIndex).to.equal(1);
        });
        it("Out-of-range number does nothing", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);

            TossupQuestionController.selectBuzzMenuPlayerByNumber(appState, 9);
            expect(appState.uiState.buzzMenuState.selectedPlayerIndex).to.equal(undefined);
        });
        it("C marks the selected player correct and closes the menu", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setSelectedWordIndex(2);
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);
            TossupQuestionController.selectBuzzMenuPlayerByNumber(appState, 1);

            TossupQuestionController.markKeyboardSelectedPlayerBuzz(appState, /* isCorrect */ true);

            const cycle: Cycle = appState.game.cycles[0];
            expect(cycle.correctBuzz).to.not.be.undefined;
            expect(cycle.correctBuzz?.marker.player.name).to.equal("Alice");
            expect(cycle.correctBuzz?.marker.position).to.equal(2);
            expect(appState.uiState.buzzMenuState.visible).to.be.false;
        });
        it("W marks the selected player wrong and closes the menu", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setSelectedWordIndex(2);
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);
            TossupQuestionController.selectBuzzMenuPlayerByNumber(appState, 2);

            TossupQuestionController.markKeyboardSelectedPlayerBuzz(appState, /* isCorrect */ false);

            const cycle: Cycle = appState.game.cycles[0];
            expect(cycle.wrongBuzzes).to.not.be.undefined;
            expect(cycle.wrongBuzzes?.length).to.equal(1);
            expect(cycle.wrongBuzzes?.[0].marker.player.name).to.equal("Bob");
            expect(cycle.wrongBuzzes?.[0].marker.position).to.equal(2);
            expect(appState.uiState.buzzMenuState.visible).to.be.false;
        });
        it("C/W without a selected player does nothing", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setSelectedWordIndex(2);
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);

            TossupQuestionController.markKeyboardSelectedPlayerBuzz(appState, /* isCorrect */ true);

            const cycle: Cycle = appState.game.cycles[0];
            expect(cycle.correctBuzz).to.be.undefined;
            expect(appState.uiState.buzzMenuState.visible).to.be.true;
        });
    });

    describe("updateBuzzPointFromReader", () => {
        it("Moves the selected word", () => {
            const appState: AppState = new AppState();
            TossupQuestionController.updateBuzzPointFromReader(appState, 5);
            expect(appState.uiState.selectedWordIndex).to.equal(5);
        });
        it("Doesn't move the selected word while the buzz menu is open", () => {
            const appState: AppState = new AppState();
            appState.uiState.setSelectedWordIndex(3);
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ true);

            TossupQuestionController.updateBuzzPointFromReader(appState, 5);
            expect(appState.uiState.selectedWordIndex).to.equal(3);
        });
    });

    describe("throwOutTossup", () => {
        it("Throw out Tossup", () => {
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([
                new Tossup("This is the first question", "Answer"),
                new Tossup("This is the second question", "Second answer"),
            ]);

            appState.game.loadPacket(packet);
            const cycle: Cycle = appState.game.cycles[0];

            TossupQuestionController.throwOutTossup(appState, cycle, 1);

            const messageDialog = appState.uiState.dialogState.messageDialog;
            if (messageDialog == undefined || messageDialog.onOK == undefined) {
                assert.fail("OK/Cancel dialog should've appeared");
            }
            messageDialog.onOK();

            if (cycle.thrownOutTossups == undefined) {
                assert.fail("ThrownOutTossups was undefined");
            }

            expect(cycle.thrownOutTossups[0].questionIndex).to.equal(0);
            expect(appState.game.getTossupIndex(0)).to.equal(1);
        });
    });
});
