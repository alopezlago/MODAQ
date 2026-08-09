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
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

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

            BonusQuestionController.throwOutBonus(appState, cycle, 0);

            const dialog = appState.uiState.dialogState.throwOutQuestionDialog;
            if (dialog == undefined || dialog.onConfirm == undefined) {
                assert.fail("Throw out question dialog should've appeared");
            }
            // defaultReplacementNumber is 1-based; onConfirm expects a 0-based packet index
            dialog.onConfirm(dialog.defaultReplacementNumber != undefined ? dialog.defaultReplacementNumber - 1 : undefined);

            if (cycle.thrownOutBonuses == undefined) {
                assert.fail("ThrownOutBonuses was undefined");
            }

            expect(cycle.thrownOutBonuses[0].questionIndex).to.equal(0);
            expect(appState.game.getBonusIndex(0)).to.equal(1);
        });
    });
});
