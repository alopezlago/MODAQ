import { expect } from "chai";

import * as ErrataPadController from "src/components/ErrataPadController";
import { AppState } from "src/state/AppState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";
import { ModalVisibilityStatus } from "src/state/ModalVisibilityStatus";

describe("ErrataPadControllerTests", () => {
    function createAppState(): AppState {
        const appState: AppState = new AppState();
        const alice: Player = new Player("Alice", "Alpha", true);
        appState.game.addNewPlayers([alice, new Player("Bob", "Beta", true)]);

        const packet: PacketState = new PacketState();
        packet.setTossups([
            new Tossup("One two three four five six seven eight", "Answer one"),
            new Tossup("Second question words here", "Answer two"),
        ]);
        packet.setBonuses([
            new Bonus("Leadin", [{ question: "Part", answer: "A", value: 10 }]),
            new Bonus("Leadin", [{ question: "Part", answer: "B", value: 10 }]),
        ]);
        appState.game.loadPacket(packet);
        return appState;
    }

    function convertFirstTossup(appState: AppState): void {
        const alice: Player = appState.game.players[0];
        appState.game.cycles[0].addCorrectBuzz(
            { player: alice, position: 3, points: 10, isLastWord: false },
            0,
            appState.game.gameFormat,
            0,
            1
        );
    }

    it("Opens on the tossup while it is live", () => {
        const appState: AppState = createAppState();
        ErrataPadController.showPad(appState);

        expect(appState.uiState.errataPad?.questionType).to.equal("tossup");
        expect(appState.uiState.errataPad?.tossupNumber).to.equal(1);
        expect(appState.uiState.errataPad?.bonusNumber).to.equal(1);
    });
    it("Opens on the bonus once the tossup is converted", () => {
        const appState: AppState = createAppState();
        convertFirstTossup(appState);
        ErrataPadController.showPad(appState);

        expect(appState.uiState.errataPad?.questionType).to.equal("bonus");
    });
    it("Notes where the reader was with read-along on", () => {
        const appState: AppState = createAppState();
        appState.uiState.setTrackReaderWithMicrophone(true);
        appState.uiState.setReaderFollowerLivePosition(5);
        ErrataPadController.showPad(appState);
        ErrataPadController.noteErratum(appState, 0, /* describe */ false);

        expect(appState.uiState.errataPad).to.be.undefined;
        expect(appState.errata.getErratum(1, "tossup")?.text).to.equal("Grammar at “…three four five six” (word 6 of 8)");
    });
    it("Leaves out the position without the microphone, and appends a second note", () => {
        const appState: AppState = createAppState();
        ErrataPadController.showPad(appState);
        ErrataPadController.noteErratum(appState, 1, false);
        ErrataPadController.showPad(appState);
        ErrataPadController.noteErratum(appState, 4, false);

        expect(appState.errata.getErratum(1, "tossup")?.text).to.equal("Factual error\nRepeat");
    });
    it("B switches to the bonus, and the bonus note has no reader position", () => {
        const appState: AppState = createAppState();
        appState.uiState.setTrackReaderWithMicrophone(true);
        appState.uiState.setReaderFollowerLivePosition(2);
        ErrataPadController.showPad(appState);
        ErrataPadController.setQuestionType(appState, "bonus");
        ErrataPadController.noteErratum(appState, 2, false);

        expect(appState.errata.getErratum(1, "bonus")?.text).to.equal("Answer line issue");
        expect(appState.errata.getErratum(1, "tossup")).to.be.undefined;
    });
    it("Other and Shift open the dialog on the note without saving it", () => {
        const appState: AppState = createAppState();
        ErrataPadController.showPad(appState);
        ErrataPadController.noteErratum(appState, 5, false);

        expect(appState.uiState.dialogState.visibleDialog).to.equal(ModalVisibilityStatus.Errata);
        expect(appState.uiState.dialogState.errataDialog?.text).to.equal("Other: ");
        expect(appState.uiState.dialogState.errataDialog?.existed).to.be.false;
        expect(appState.errata.getErratum(1, "tossup")).to.be.undefined;
    });
});
