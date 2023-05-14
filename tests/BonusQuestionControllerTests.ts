import { assert, expect } from "chai";

import * as BonusQuestionController from "src/components/BonusQuestionController";
import * as GameFormats from "src/state/GameFormats";
import { Player } from "src/state/TeamState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";
import { AppState } from "src/state/AppState";

describe("BonusQuestionControllerTests", () => {
    describe("throwOutBonus", () => {
        it("Throw out Bonus", () => {
            AppState.resetInstance();
            const appState: AppState = AppState.instance;
            appState.game.addPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([
                new Tossup("This is the first question", "Answer"),
                new Tossup("This is the second question", "Second answer"),
            ]);
            packet.setBonuses([new Bonus("First leadin", []), new Bonus("Second leadin", [])]);

            appState.game.loadPacket(packet);
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                { player: appState.game.players[0], points: 10, position: 0 },
                0,
                GameFormats.UndefinedGameFormat,
                0,
                3
            );

            BonusQuestionController.throwOutBonus(cycle, 0);

            const messageDialog = appState.uiState.dialogState.messageDialog;
            if (messageDialog == undefined || messageDialog.onOK == undefined) {
                assert.fail("OK/Cancel dialog should've appeared");
            }
            messageDialog.onOK();

            if (cycle.thrownOutBonuses == undefined) {
                assert.fail("ThrownOutBonuses was undefined");
            }

            expect(cycle.thrownOutBonuses[0].questionIndex).to.equal(0);
            expect(appState.game.getBonusIndex(0)).to.equal(1);
        });
    });
});
