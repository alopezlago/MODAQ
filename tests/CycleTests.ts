import { expect } from "chai";
import { Cycle } from "src/state/Cycle";
import { IBuzzMarker } from "src/state/IBuzzMarker";
import { Team, Player } from "src/state/TeamState";

describe("CycleTests", () => {
    describe("addCorrectBuzz", () => {
        it("Adds buzz", () => {
            const cycle: Cycle = new Cycle();

            const team: Team = new Team("Alpha");
            const marker: IBuzzMarker = {
                player: new Player("Alice", team),
                position: 10,
                correct: true,
            };
            cycle.addCorrectBuzz(marker, 2);

            expect(cycle.correctBuzz).to.exist;
            expect(cycle.correctBuzz?.tossupIndex).to.equal(2);
            expect(cycle.correctBuzz?.marker).to.deep.equal(marker);
        });
    });
});
