import { assert, expect } from "chai";

import * as TossupQuestionController from "src/components/TossupQuestionController";
import { Player } from "src/state/TeamState";
import { PacketState, Tossup } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";
import { AppState } from "src/state/AppState";

describe("TossupQuestionControllerTests", () => {
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
