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

    describe("handleBuzzShortcut", () => {
        function createAppStateWithPacket(): AppState {
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([new Tossup("This is the first question", "Answer")]);
            appState.game.loadPacket(packet);
            appState.uiState.setTrackReaderWithMicrophone(true);
            return appState;
        }

        it("Places the buzz point at the live reading position and opens the pad", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(3);

            TossupQuestionController.handleBuzzShortcut(appState, /* now */ 1000000);

            expect(appState.uiState.selectedWordIndex).to.equal(3);
            expect(appState.uiState.buzzPointPlacement).to.not.be.undefined;
        });
        it("A second press keeps the pad open at the placed word", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(3);

            TossupQuestionController.handleBuzzShortcut(appState, 1000000);
            TossupQuestionController.moveBuzzPoint(appState, -1);
            TossupQuestionController.handleBuzzShortcut(appState, 1000500);

            expect(appState.uiState.selectedWordIndex).to.equal(2);
            expect(appState.uiState.buzzPointPlacement).to.not.be.undefined;
        });
        it("A buzzer sound opens the pad at the reader's position, and Space confirms it", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(2);

            TossupQuestionController.handleBuzzSound(appState, 1000000);
            expect(appState.uiState.selectedWordIndex).to.equal(2);
            expect(appState.uiState.buzzPointPlacement?.startedByBuzzSound).to.be.true;

            appState.uiState.setReaderFollowerLivePosition(3);
            TossupQuestionController.handleBuzzShortcut(appState, 1000400);
            expect(appState.uiState.selectedWordIndex).to.equal(2);
            expect(appState.uiState.buzzPointPlacement?.startedByBuzzSound).to.be.false;
        });
        it("Clicking a word opens the pad there; the reader's position doesn't move it", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(1);

            TossupQuestionController.placeBuzzPointAt(appState, 4, /* anchorToWord */ true, 1000000);
            TossupQuestionController.catchUpBuzzPointPlacement(appState, 2, 1000100);

            expect(appState.uiState.selectedWordIndex).to.equal(4);
            expect(appState.uiState.buzzPointPlacement).to.not.be.undefined;
        });
        it("Applies the buzz point offset", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(3);
            appState.uiState.setBuzzPointWordOffset(-2);

            TossupQuestionController.handleBuzzShortcut(appState, 1000000);

            expect(appState.uiState.selectedWordIndex).to.equal(1);
        });
        it("With the microphone on, starts at the reader's position even if another word is selected", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(3);
            appState.uiState.setSelectedWordIndex(1);

            TossupQuestionController.handleBuzzShortcut(appState, 1000000);

            expect(appState.uiState.selectedWordIndex).to.equal(3);
        });
        it("With the microphone on and nothing recognized yet, starts at the first word", () => {
            const appState: AppState = createAppStateWithPacket();

            TossupQuestionController.handleBuzzShortcut(appState, 1000000);

            expect(appState.uiState.selectedWordIndex).to.equal(0);
        });
        it("With the microphone off, falls back to the end of the question with no selection", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setTrackReaderWithMicrophone(false);

            TossupQuestionController.handleBuzzShortcut(appState, /* now */ 1000000);

            // "This is the first question" plus the end-of-question marker; the last buzzable index is 5
            expect(appState.uiState.selectedWordIndex).to.equal(5);
        });
        it("A stale placement is replaced by a new one at the reader's position", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(1);
            TossupQuestionController.handleBuzzShortcut(appState, 1000000);

            appState.uiState.setReaderFollowerLivePosition(4);
            TossupQuestionController.handleBuzzShortcut(appState, 1010000);

            expect(appState.uiState.selectedWordIndex).to.equal(4);
            expect(appState.uiState.buzzPointPlacement).to.not.be.undefined;
        });
        it("Escape cancels placement and clears the selection", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(3);
            TossupQuestionController.handleBuzzShortcut(appState, 1000000);

            TossupQuestionController.cancelBuzzPointPlacement(appState);

            expect(appState.uiState.buzzPointPlacement).to.be.undefined;
            expect(appState.uiState.selectedWordIndex).to.equal(-1);
        });
        it("Moving to another question ends placement", () => {
            const appState: AppState = createAppStateWithPacket();
            appState.uiState.setReaderFollowerLivePosition(3);
            TossupQuestionController.handleBuzzShortcut(appState, 1000000);

            appState.uiState.nextCycle();

            expect(appState.uiState.buzzPointPlacement).to.be.undefined;
        });
    });

    describe("buzz menu option", () => {
        function createGame(): AppState {
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([new Tossup("This is the first question", "Answer")]);
            appState.game.loadPacket(packet);
            appState.uiState.setTrackReaderWithMicrophone(true);
            return appState;
        }

        it("Is off by default", () => {
            expect(new AppState().uiState.useBuzzMenu).to.be.false;
        });
        it("With the buzz menu, the second Space opens it on the placed word", () => {
            const appState: AppState = createGame();
            appState.uiState.toggleUseBuzzMenu();
            appState.uiState.setReaderFollowerLivePosition(3);

            TossupQuestionController.handleBuzzShortcut(appState, 1000000);
            expect(appState.uiState.buzzMenuState.visible).to.be.false;
            TossupQuestionController.moveBuzzPoint(appState, -1);
            TossupQuestionController.handleBuzzShortcut(appState, 1000500);

            expect(appState.uiState.buzzMenuState.visible).to.be.true;
            expect(appState.uiState.buzzMenuState.clearSelectedWordOnClose).to.be.true;
            expect(appState.uiState.selectedWordIndex).to.equal(2);
            expect(appState.uiState.buzzPointPlacement).to.be.undefined;
        });
        it("Without the buzz menu, the second Space keeps the pad open", () => {
            const appState: AppState = createGame();
            appState.uiState.setReaderFollowerLivePosition(3);

            TossupQuestionController.handleBuzzShortcut(appState, 1000000);
            TossupQuestionController.handleBuzzShortcut(appState, 1000500);

            expect(appState.uiState.buzzMenuState.visible).to.be.false;
            expect(appState.uiState.buzzPointPlacement).to.not.be.undefined;
        });
        it("With the buzz menu, E opens it at the end of the question", () => {
            const appState: AppState = createGame();
            appState.uiState.toggleUseBuzzMenu();

            TossupQuestionController.placeBuzzPointAtEnd(appState);

            // "This is the first question" plus the end-of-question marker; the last buzzable index is 5
            expect(appState.uiState.selectedWordIndex).to.equal(5);
            expect(appState.uiState.buzzMenuState.visible).to.be.true;
            expect(appState.uiState.buzzPointPlacement).to.be.undefined;
        });
        it("The reader's position doesn't move the selected word while the buzz menu is open", () => {
            const appState: AppState = createGame();
            appState.uiState.setSelectedWordIndex(2);
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ true);

            TossupQuestionController.updateBuzzPointFromReader(appState, 4);
            expect(appState.uiState.selectedWordIndex).to.equal(2);
        });
    });

    describe("catchUpBuzzPointPlacement", () => {
        function startPlacement(livePosition: number): AppState {
            const appState: AppState = new AppState();
            const packet: PacketState = new PacketState();
            packet.setTossups([new Tossup("One two three four five six seven eight", "Answer")]);
            appState.game.loadPacket(packet);
            appState.uiState.setTrackReaderWithMicrophone(true);
            appState.uiState.setReaderFollowerLivePosition(livePosition);
            TossupQuestionController.handleBuzzShortcut(appState, /* now */ 1000000);
            return appState;
        }

        it("Words recognized just after Space move the buzz point forward", () => {
            const appState: AppState = startPlacement(2);
            TossupQuestionController.catchUpBuzzPointPlacement(appState, 4, 1000400);
            expect(appState.uiState.selectedWordIndex).to.equal(4);
        });
        it("A word or two recognized long after Space doesn't move it", () => {
            const appState: AppState = startPlacement(2);
            TossupQuestionController.catchUpBuzzPointPlacement(appState, 4, 1005000);
            expect(appState.uiState.selectedWordIndex).to.equal(2);
            expect(appState.uiState.buzzPointPlacement).to.not.be.undefined;
        });
        it("Reading clearly resuming after Space drops the placement", () => {
            const appState: AppState = startPlacement(2);
            TossupQuestionController.catchUpBuzzPointPlacement(appState, 6, 1005000);
            expect(appState.uiState.buzzPointPlacement).to.be.undefined;
            expect(appState.uiState.selectedWordIndex).to.equal(-1);
        });
        it("Doesn't override a buzz point the moderator moved", () => {
            const appState: AppState = startPlacement(2);
            TossupQuestionController.moveBuzzPoint(appState, -1);
            TossupQuestionController.catchUpBuzzPointPlacement(appState, 4, 1000400);
            expect(appState.uiState.selectedWordIndex).to.equal(1);
        });
        it("Doesn't move it backwards", () => {
            const appState: AppState = startPlacement(2);
            TossupQuestionController.catchUpBuzzPointPlacement(appState, 1, 1000400);
            expect(appState.uiState.selectedWordIndex).to.equal(2);
        });
    });

    describe("recordPlayerPadBuzz", () => {
        function createGame(): AppState {
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([new Tossup("One two three four five six seven eight", "Answer")]);
            appState.game.loadPacket(packet);
            return appState;
        }

        it("Records a correct buzz at the reader's position, with the offset", () => {
            const appState: AppState = createGame();
            appState.uiState.setTrackReaderWithMicrophone(true);
            appState.uiState.setReaderFollowerLivePosition(4);
            appState.uiState.setBuzzPointWordOffset(-1);

            expect(TossupQuestionController.recordPlayerPadBuzz(appState, 0, /* isCorrect */ true)).to.be.true;

            const cycle: Cycle = appState.game.cycles[0];
            expect(cycle.correctBuzz?.marker.player.name).to.equal("Alice");
            expect(cycle.correctBuzz?.marker.position).to.equal(3);
        });
        it("Records a wrong buzz for the player at that index", () => {
            const appState: AppState = createGame();
            appState.uiState.setTrackReaderWithMicrophone(true);
            appState.uiState.setReaderFollowerLivePosition(2);

            TossupQuestionController.recordPlayerPadBuzz(appState, 1, /* isCorrect */ false);

            const cycle: Cycle = appState.game.cycles[0];
            expect(cycle.wrongBuzzes?.length).to.equal(1);
            expect(cycle.wrongBuzzes?.[0].marker.player.name).to.equal("Bob");
            expect(cycle.wrongBuzzes?.[0].marker.position).to.equal(2);
        });
        it("Uses the placed buzz point after Space, and ends placement", () => {
            const appState: AppState = createGame();
            appState.uiState.setTrackReaderWithMicrophone(true);
            appState.uiState.setReaderFollowerLivePosition(4);
            TossupQuestionController.handleBuzzShortcut(appState, 1000000);
            TossupQuestionController.moveBuzzPoint(appState, -2);

            TossupQuestionController.recordPlayerPadBuzz(appState, 0, /* isCorrect */ true);

            expect(appState.game.cycles[0].correctBuzz?.marker.position).to.equal(2);
            expect(appState.uiState.buzzPointPlacement).to.be.undefined;
            expect(appState.uiState.selectedWordIndex).to.equal(-1);
        });
        it("Without the microphone, uses the end of the question when nothing is selected", () => {
            const appState: AppState = createGame();

            TossupQuestionController.recordPlayerPadBuzz(appState, 1, /* isCorrect */ false);

            // Eight words plus the end-of-question marker
            expect(appState.game.cycles[0].wrongBuzzes?.[0].marker.position).to.equal(8);
        });
        it("Pressing a player's wrong shortcut again removes their wrong buzz", () => {
            const appState: AppState = createGame();
            appState.uiState.setTrackReaderWithMicrophone(true);
            appState.uiState.setReaderFollowerLivePosition(2);
            TossupQuestionController.recordPlayerPadBuzz(appState, 1, /* isCorrect */ false);

            // The reader has moved on; the second press still finds Bob's buzz
            appState.uiState.setReaderFollowerLivePosition(5);
            TossupQuestionController.recordPlayerPadBuzz(appState, 1, /* isCorrect */ false);

            expect(appState.game.cycles[0].wrongBuzzes ?? []).to.be.empty;
        });
        it("A protest starts for a player who buzzed, at their buzz", () => {
            const appState: AppState = createGame();
            appState.uiState.setTrackReaderWithMicrophone(true);
            appState.uiState.setReaderFollowerLivePosition(2);
            TossupQuestionController.recordPlayerPadBuzz(appState, 1, /* isCorrect */ false);

            TossupQuestionController.togglePlayerPadProtest(appState, 1);

            expect(appState.uiState.pendingTossupProtestEvent?.teamName).to.equal("Beta");
            expect(appState.uiState.pendingTossupProtestEvent?.position).to.equal(2);
        });
        it("No protest for a player who didn't buzz", () => {
            const appState: AppState = createGame();
            TossupQuestionController.togglePlayerPadProtest(appState, 0);
            expect(appState.uiState.pendingTossupProtestEvent).to.be.undefined;
        });
        it("An index past the players does nothing", () => {
            const appState: AppState = createGame();
            expect(TossupQuestionController.recordPlayerPadBuzz(appState, 5, /* isCorrect */ true)).to.be.false;
            expect(appState.game.cycles[0].correctBuzz).to.be.undefined;
        });
    });

    describe("findWordOnAdjacentLine", () => {
        // Three lines of words, 20px tall, laid out like rendered text:
        //   0 1 2 3
        //   4 5 6
        //   7 8
        const boxes: TossupQuestionController.IWordBox[] = [
            { index: 0, left: 0, right: 40, top: 0, bottom: 20 },
            { index: 1, left: 50, right: 90, top: 0, bottom: 20 },
            { index: 2, left: 100, right: 160, top: 0, bottom: 20 },
            { index: 3, left: 170, right: 200, top: 0, bottom: 20 },
            { index: 4, left: 0, right: 70, top: 25, bottom: 45 },
            { index: 5, left: 80, right: 120, top: 25, bottom: 45 },
            { index: 6, left: 130, right: 200, top: 25, bottom: 45 },
            { index: 7, left: 0, right: 100, top: 50, bottom: 70 },
            { index: 8, left: 110, right: 150, top: 50, bottom: 70 },
        ];

        it("Up goes to the horizontally closest word on the line above", () => {
            expect(TossupQuestionController.findWordOnAdjacentLine(boxes, 5, -1)).to.equal(1);
            expect(TossupQuestionController.findWordOnAdjacentLine(boxes, 6, -1)).to.equal(3);
        });
        it("Down goes to the horizontally closest word on the line below", () => {
            expect(TossupQuestionController.findWordOnAdjacentLine(boxes, 2, 1)).to.equal(5);
            expect(TossupQuestionController.findWordOnAdjacentLine(boxes, 5, 1)).to.equal(8);
        });
        it("Skips only one line at a time", () => {
            expect(TossupQuestionController.findWordOnAdjacentLine(boxes, 8, -1)).to.equal(5);
        });
        it("Stays put at the first or last line", () => {
            expect(TossupQuestionController.findWordOnAdjacentLine(boxes, 1, -1)).to.be.undefined;
            expect(TossupQuestionController.findWordOnAdjacentLine(boxes, 7, 1)).to.be.undefined;
        });
    });

    describe("getOrderedPlayers", () => {
        it("Players are ordered by team then player", () => {
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([
                new Player("Alice", "Alpha", true),
                new Player("Bob", "Beta", true),
                new Player("Carol", "Alpha", true),
            ]);
            const packet: PacketState = new PacketState();
            packet.setTossups([new Tossup("One two three", "Answer")]);
            appState.game.loadPacket(packet);

            const names: string[] = TossupQuestionController.getOrderedPlayers(appState).map((player) => player.name);
            expect(names).to.deep.equal(["Alice", "Carol", "Bob"]);
        });
    });

    describe("updateBuzzPointFromReader", () => {
        it("Moves the selected word", () => {
            const appState: AppState = new AppState();
            TossupQuestionController.updateBuzzPointFromReader(appState, 5);
            expect(appState.uiState.selectedWordIndex).to.equal(5);
        });
        it("Doesn't move the selected word while the pad is open", () => {
            const appState: AppState = new AppState();
            const packet: PacketState = new PacketState();
            packet.setTossups([new Tossup("One two three four five six", "Answer")]);
            appState.game.loadPacket(packet);
            TossupQuestionController.placeBuzzPointAt(appState, 3, /* anchorToWord */ true);

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

            const dialog = appState.uiState.dialogState.throwOutQuestionDialog;
            if (dialog == undefined || dialog.onConfirm == undefined) {
                assert.fail("Throw out question dialog should've appeared");
            }
            // defaultReplacementNumber is 1-based; onConfirm expects a 0-based packet index
            dialog.onConfirm(dialog.defaultReplacementNumber != undefined ? dialog.defaultReplacementNumber - 1 : undefined);

            if (cycle.thrownOutTossups == undefined) {
                assert.fail("ThrownOutTossups was undefined");
            }

            expect(cycle.thrownOutTossups[0].questionIndex).to.equal(0);
            expect(appState.game.getTossupIndex(0)).to.equal(1);
        });
    });
});
