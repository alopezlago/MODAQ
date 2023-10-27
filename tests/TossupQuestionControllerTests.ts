import { assert, expect } from "chai";

import * as TossupQuestionController from "src/components/TossupQuestionController";
import { Player } from "src/state/TeamState";
import { PacketState, Tossup } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";
import { AppState } from "src/state/AppState";

describe("TossupQuestionControllerTests", () => {
    describe("throwOutTossup", () => {
        it("Throw out Tossup", () => {
            AppState.resetInstance();
            const appState: AppState = AppState.instance;
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([
                new Tossup("This is the first question", "Answer"),
                new Tossup("This is the second question", "Second answer"),
            ]);

            appState.game.loadPacket(packet);
            const cycle: Cycle = appState.game.cycles[0];

            TossupQuestionController.throwOutTossup(cycle, 1);

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
