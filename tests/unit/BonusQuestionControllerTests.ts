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
            expect(dialog.minQuestionNumber).to.equal(2);
            expect(dialog.defaultReplacementNumber).to.equal(2);

            // Sequential default replacements stay implicit and let later bonuses shift.
            dialog.onConfirm(undefined);

            if (cycle.thrownOutBonuses == undefined) {
                assert.fail("ThrownOutBonuses was undefined");
            }

            expect(cycle.thrownOutBonuses[0].questionIndex).to.equal(0);
            expect(appState.game.getBonusIndex(0)).to.equal(1);
        });

        it("Allows multiple sequential thrown out bonuses in one cycle", () => {
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([
                new Tossup("This is the first question", "Answer"),
                new Tossup("This is the second question", "Second answer"),
            ]);
            packet.setBonuses([
                new Bonus("First leadin", []),
                new Bonus("Second leadin", []),
                new Bonus("Third leadin", []),
            ]);

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

            const firstDialog = appState.uiState.dialogState.throwOutQuestionDialog;
            if (firstDialog == undefined || firstDialog.onConfirm == undefined) {
                assert.fail("First throw out question dialog should've appeared");
            }

            expect(firstDialog.defaultReplacementNumber).to.equal(2);
            firstDialog.onConfirm(undefined);
            expect(appState.game.getBonusIndex(0)).to.equal(1);

            BonusQuestionController.throwOutBonus(appState, cycle, 1);

            const secondDialog = appState.uiState.dialogState.throwOutQuestionDialog;
            if (secondDialog == undefined || secondDialog.onConfirm == undefined) {
                assert.fail("Second throw out question dialog should've appeared");
            }

            expect(secondDialog.minQuestionNumber).to.equal(3);
            expect(secondDialog.defaultReplacementNumber).to.equal(3);
            secondDialog.onConfirm(undefined);

            if (cycle.thrownOutBonuses == undefined) {
                assert.fail("ThrownOutBonuses was undefined");
            }

            expect(cycle.thrownOutBonuses.map((bonus) => bonus.questionIndex)).to.deep.equal([0, 1]);
            expect(appState.game.getBonusIndex(0)).to.equal(2);
        });

        it("Protest bonus throw-out records an explicit replacement and does not shift later cycles", () => {
            const appState: AppState = new AppState();
            appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

            const packet: PacketState = new PacketState();
            packet.setTossups([
                new Tossup("This is the first question", "Answer"),
                new Tossup("This is the second question", "Second answer"),
                new Tossup("This is the third question", "Third answer"),
            ]);
            packet.setBonuses([
                new Bonus("First leadin", []),
                new Bonus("Second leadin", []),
                new Bonus("Third leadin", []),
                new Bonus("Fourth leadin", []),
            ]);

            appState.game.loadPacket(packet);

            const firstCycle: Cycle = appState.game.cycles[0];
            firstCycle.addCorrectBuzz(
                { player: appState.game.players[0], points: 10, position: 0 },
                0,
                GameFormats.UndefinedGameFormat,
                0,
                3
            );

            // A later cycle already has its own bonus recorded. Throwing out the first bonus is a protest: that
            // bonus must be replaced from the end of the packet without disturbing the bonus this cycle answered.
            const secondCycle: Cycle = appState.game.cycles[1];
            secondCycle.addCorrectBuzz(
                { player: appState.game.players[1], points: 10, position: 0 },
                1,
                GameFormats.UndefinedGameFormat,
                1,
                3
            );

            expect(appState.game.getBonusIndex(0)).to.equal(0);
            expect(appState.game.getBonusIndex(1)).to.equal(1);

            BonusQuestionController.throwOutBonus(appState, firstCycle, 0);
            const dialog = appState.uiState.dialogState.throwOutQuestionDialog;
            if (dialog == undefined || dialog.onConfirm == undefined) {
                assert.fail("Throw out question dialog should've appeared");
            }

            // The protest default is the packet's last bonus, recorded explicitly.
            expect(dialog.defaultReplacementIsExplicit).to.equal(true);
            expect(dialog.minQuestionNumber).to.equal(2);
            if (dialog.defaultReplacementNumber == undefined) {
                assert.fail("Protest bonus throw-out should have a default replacement number");
            }
            expect(dialog.defaultReplacementNumber).to.equal(4);

            // Confirming the explicit default sends the 0-based replacement index, as the dialog does.
            dialog.onConfirm(dialog.defaultReplacementNumber - 1);

            if (firstCycle.thrownOutBonuses == undefined) {
                assert.fail("ThrownOutBonuses was undefined");
            }

            expect(firstCycle.thrownOutBonuses[0].questionIndex).to.equal(0);
            expect(firstCycle.thrownOutBonuses[0].replacementQuestionIndex).to.equal(3);

            // The thrown-out cycle now shows the last bonus, and the later cycle's bonus is unchanged (no shift).
            expect(appState.game.getBonusIndex(0)).to.equal(3);
            expect(appState.game.getBonusIndex(1)).to.equal(1);
        });
    });
});
