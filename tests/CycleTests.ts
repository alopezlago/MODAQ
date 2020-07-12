import { expect } from "chai";
import { Cycle } from "src/state/Cycle";
import { IBuzzMarker } from "src/state/IBuzzMarker";
import { Player } from "src/state/TeamState";

describe("CycleTests", () => {
    describe("addCorrectBuzz", () => {
        it("Adds buzz", () => {
            const cycle: Cycle = new Cycle();

            const marker: IBuzzMarker = {
                player: new Player("Alice", "Alpha", /* isStarter */ true),
                position: 10,
                correct: true,
            };
            cycle.addCorrectBuzz(marker, 2, 1);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(2);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);

            expect(cycle.bonusAnswer).to.exist;
            expect(cycle.bonusAnswer?.bonusIndex).to.equal(1);
            expect(cycle.bonusAnswer?.correctParts.length).to.equal(0);
        });
    });
});
