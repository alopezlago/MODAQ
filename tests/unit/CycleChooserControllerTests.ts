import { expect } from "chai";

import * as CycleChooserController from "src/components/CycleChooserController";
import * as GameFormats from "src/state/GameFormats";
import { AppState } from "src/state/AppState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { IGameFormat } from "src/state/IGameFormat";
import { Player } from "src/state/TeamState";

const tossupCount = 4;

function createAppState(formatOverrides: Partial<IGameFormat> = {}): AppState {
    const appState: AppState = new AppState();
    appState.game.addNewPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

    const packet: PacketState = new PacketState();
    packet.setTossups(
        Array.from({ length: tossupCount }, (unused, index) => new Tossup(`Tossup ${index + 1}`, `Answer ${index + 1}`))
    );
    packet.setBonuses(
        Array.from(
            { length: tossupCount },
            (unused, index) =>
                new Bonus(`Leadin ${index + 1}`, [
                    { question: "Part", answer: "Part answer", value: 10 },
                    { question: "Part", answer: "Part answer", value: 10 },
                    { question: "Part", answer: "Part answer", value: 10 },
                ])
        )
    );

    appState.game.loadPacket(packet);
    appState.game.setGameFormat({
        ...GameFormats.ACFGameFormat,
        regulationTossupCount: tossupCount,
        ...formatOverrides,
    });
    appState.uiState.toggleOneQuestionAtATime();

    return appState;
}

function convertTossup(appState: AppState, cycleIndex: number): void {
    appState.game.cycles[cycleIndex].addCorrectBuzz(
        { player: appState.game.players[0], points: 10, position: 0 },
        cycleIndex,
        appState.game.gameFormat,
        cycleIndex,
        3
    );
}

/** Where the reader is, as the UI shows it. */
function step(appState: AppState): string {
    return `${CycleChooserController.isOnBonus(appState) ? "bonus" : "tossup"} ${appState.uiState.cycleIndex + 1}`;
}

describe("CycleChooserControllerTests", () => {
    describe("next", () => {
        it("a dead tossup goes straight to the next tossup", () => {
            const appState: AppState = createAppState();

            CycleChooserController.next(appState);

            expect(step(appState)).to.equal("tossup 2");
        });

        it("a converted tossup goes to its bonus, then to the next tossup", () => {
            const appState: AppState = createAppState();
            convertTossup(appState, 0);

            CycleChooserController.next(appState);
            expect(step(appState)).to.equal("bonus 1");

            CycleChooserController.next(appState);
            expect(step(appState)).to.equal("tossup 2");
        });

        it("converting the tossup while it is up adds the bonus step", () => {
            const appState: AppState = createAppState();

            // The reader is looking at tossup 1 when the buzz comes in
            expect(CycleChooserController.nextStepIsBonus(appState)).to.be.false;
            convertTossup(appState, 0);
            expect(CycleChooserController.nextStepIsBonus(appState)).to.be.true;
        });

        it("undoing the correct buzz while the bonus is up falls back to the tossup", () => {
            const appState: AppState = createAppState();
            convertTossup(appState, 0);
            CycleChooserController.next(appState);
            expect(step(appState)).to.equal("bonus 1");

            appState.game.cycles[0].removeCorrectBuzz();

            expect(step(appState)).to.equal("tossup 1");
            CycleChooserController.next(appState);
            expect(step(appState)).to.equal("tossup 2");
        });

        it("no bonus is read in overtime when the format says so", () => {
            // Regulation ends after two questions, so questions 3 and 4 are overtime
            const appState: AppState = createAppState({ regulationTossupCount: 2, overtimeIncludesBonuses: false });
            appState.uiState.setCycleIndex(2);
            convertTossup(appState, 2);

            expect(CycleChooserController.nextStepIsBonus(appState)).to.be.false;
        });

        it("the bonus is read in overtime when the format says so", () => {
            const appState: AppState = createAppState({ regulationTossupCount: 2, overtimeIncludesBonuses: true });
            appState.uiState.setCycleIndex(2);
            convertTossup(appState, 2);

            expect(CycleChooserController.nextStepIsBonus(appState)).to.be.true;
        });
    });

    describe("previous", () => {
        it("from a bonus, goes back to its own tossup", () => {
            const appState: AppState = createAppState();
            convertTossup(appState, 0);
            CycleChooserController.next(appState);

            CycleChooserController.previous(appState);

            expect(step(appState)).to.equal("tossup 1");
        });

        it("from a tossup, goes back to the previous question's bonus when it was converted", () => {
            const appState: AppState = createAppState();
            convertTossup(appState, 0);
            appState.uiState.setCycleIndex(1);

            CycleChooserController.previous(appState);

            expect(step(appState)).to.equal("bonus 1");
        });

        it("from a tossup, goes back to the previous tossup when that one went dead", () => {
            const appState: AppState = createAppState();
            appState.uiState.setCycleIndex(1);

            CycleChooserController.previous(appState);

            expect(step(appState)).to.equal("tossup 1");
        });

        it("stops at the first tossup", () => {
            const appState: AppState = createAppState();

            expect(CycleChooserController.canGoPrevious(appState)).to.be.false;
            CycleChooserController.previous(appState);

            expect(step(appState)).to.equal("tossup 1");
        });

        it("the first question's bonus can still go back", () => {
            const appState: AppState = createAppState();
            convertTossup(appState, 0);
            CycleChooserController.next(appState);

            expect(CycleChooserController.canGoPrevious(appState)).to.be.true;
        });
    });

    describe("isOnLastStep", () => {
        it("the last tossup ends the game when it goes dead", () => {
            const appState: AppState = createAppState();
            appState.uiState.setCycleIndex(tossupCount - 1);

            expect(CycleChooserController.isOnLastStep(appState)).to.be.true;
        });

        it("the last tossup's bonus is still read before exporting", () => {
            const appState: AppState = createAppState();
            appState.uiState.setCycleIndex(tossupCount - 1);
            convertTossup(appState, tossupCount - 1);

            expect(CycleChooserController.isOnLastStep(appState)).to.be.false;

            CycleChooserController.next(appState);

            expect(step(appState)).to.equal(`bonus ${tossupCount}`);
            expect(CycleChooserController.isOnLastStep(appState)).to.be.true;
        });
    });

    describe("with the mode off", () => {
        it("next and previous move by question, and the bonus is never its own step", () => {
            const appState: AppState = createAppState();
            appState.uiState.toggleOneQuestionAtATime();
            convertTossup(appState, 0);

            expect(CycleChooserController.nextStepIsBonus(appState)).to.be.false;

            CycleChooserController.next(appState);
            expect(step(appState)).to.equal("tossup 2");

            CycleChooserController.previous(appState);
            expect(step(appState)).to.equal("tossup 1");
        });

        it("turning the mode off while a bonus is up returns to the whole question", () => {
            const appState: AppState = createAppState();
            convertTossup(appState, 0);
            CycleChooserController.next(appState);
            expect(appState.uiState.showingBonus).to.be.true;

            appState.uiState.toggleOneQuestionAtATime();

            expect(appState.uiState.showingBonus).to.be.false;
            expect(CycleChooserController.isOnBonus(appState)).to.be.false;
        });
    });
});
