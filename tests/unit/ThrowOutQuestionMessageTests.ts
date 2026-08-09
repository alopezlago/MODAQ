import { expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import { AppState } from "src/state/AppState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";
import { IGameFormat } from "src/state/IGameFormat";
import { getThrowOutQuestionPrompt } from "src/components/ThrowOutQuestionMessage";

const players: Player[] = [
    new Player("Alice", "A", /* isStarter */ true),
    new Player("Bob", "B", /* isStarter */ true),
];

function createPacket(): PacketState {
    const packet: PacketState = new PacketState();
    packet.setTossups([
        new Tossup("first q", "first a"),
        new Tossup("second q", "second a"),
        new Tossup("third q", "third a"),
        new Tossup("fourth q", "fourth a"),
    ]);
    packet.setBonuses([
        new Bonus("first leadin", [{ question: "first q", answer: "first a", value: 10 }]),
        new Bonus("second leadin", [{ question: "second q", answer: "second a", value: 10 }]),
        new Bonus("third leadin", [{ question: "third q", answer: "third a", value: 10 }]),
        new Bonus("fourth leadin", [{ question: "fourth q", answer: "fourth a", value: 10 }]),
    ]);
    return packet;
}

function createAppState(gameFormat?: IGameFormat): AppState {
    const appState: AppState = new AppState();
    appState.game.addNewPlayers(players);
    appState.game.loadPacket(createPacket());
    if (gameFormat != undefined) {
        appState.game.setGameFormat(gameFormat);
    }

    return appState;
}

describe("ThrowOutQuestionMessageTests", () => {
    describe("getThrowOutQuestionPrompt", () => {
        it("Procedural: mid-game with no events afterward replaces with the next question", () => {
            const appState: AppState = createAppState();

            // Throw out tossup 1 (cycle 0) with nothing recorded afterward => moderator procedural error.
            const { message, replacementIndex } = getThrowOutQuestionPrompt(appState, 0, "tossup", 1);

            expect(replacementIndex).to.equal(1); // next sequential tossup (0-based)
            expect(message).to.contain("procedural error");
            expect(message).to.contain("replaced with tossup 2");
        });

        it("Protest: mid-game with events afterward replaces with the last question in the packet", () => {
            const appState: AppState = createAppState();

            // Record a buzz in a later cycle so there is game data after cycle 0 => protest resolution.
            appState.game.cycles[1].addWrongBuzz(
                { player: players[0], points: -5, position: 0 },
                1,
                appState.game.gameFormat
            );

            const { message, replacementIndex } = getThrowOutQuestionPrompt(appState, 0, "tossup", 1);

            expect(replacementIndex).to.equal(3); // last tossup in the 4-question packet (0-based)
            expect(message).to.contain("protest resolution");
            expect(message).to.contain("replaced with tossup 4");
        });

        it("Tiebreaker: an overtime tossup in a sudden-death format is a tiebreaker", () => {
            // regulationTossupCount 2 => cycle index 2 is the first overtime tossup; sudden death (1 OT question).
            const format: IGameFormat = {
                ...GameFormats.ACFGameFormat,
                regulationTossupCount: 2,
                minimumOvertimeQuestionCount: 1,
            };
            const appState: AppState = createAppState(format);

            const { message, replacementIndex } = getThrowOutQuestionPrompt(appState, 2, "tossup", 3);

            expect(replacementIndex).to.equal(3); // next sequential tossup (0-based)
            expect(message).to.contain("tiebreaker tossup");
            expect(message).to.contain("replaced with tossup 4");
        });

        it("Tiebreaker only applies in sudden-death formats, not fixed-block overtime", () => {
            // Same overtime cycle, but a fixed 3-question overtime block is not sudden death, so it falls through.
            const format: IGameFormat = {
                ...GameFormats.ACFGameFormat,
                regulationTossupCount: 2,
                minimumOvertimeQuestionCount: 3,
            };
            const appState: AppState = createAppState(format);

            const { message, replacementIndex } = getThrowOutQuestionPrompt(appState, 2, "tossup", 3);

            expect(replacementIndex).to.equal(3);
            expect(message).to.contain("procedural error");
            expect(message).to.not.contain("tiebreaker");
        });

        it("Tiebreaker: a sudden-death tossup past the fixed overtime block is a tiebreaker", () => {
            // regulationTossupCount 1 plus a fixed 2-question overtime block => cycles 1 and 2 are the block and
            // cycle 3 is sudden death, so it's a tiebreaker even though the format isn't sudden death from the start.
            const format: IGameFormat = {
                ...GameFormats.ACFGameFormat,
                regulationTossupCount: 1,
                minimumOvertimeQuestionCount: 2,
            };
            const appState: AppState = createAppState(format);

            const { message, replacementIndex } = getThrowOutQuestionPrompt(appState, 3, "tossup", 4);

            expect(message).to.contain("tiebreaker tossup");
            // Question 4 is the last in the packet, so there's nothing sequential to replace it with
            expect(replacementIndex).to.equal(undefined);
        });

        it("No replacement available when the packet has no more questions", () => {
            const appState: AppState = createAppState();

            // Throw out the last tossup (question 4); there is no next question to replace it with.
            const { message, replacementIndex } = getThrowOutQuestionPrompt(appState, 3, "tossup", 4);

            expect(replacementIndex).to.equal(undefined);
            expect(message).to.contain("Additional questions need to be uploaded");
        });

        it("Bonus throw-out uses the bonus wording and is never a tiebreaker", () => {
            const appState: AppState = createAppState();

            const { message, replacementIndex, defaultReplacementIsExplicit } = getThrowOutQuestionPrompt(
                appState,
                0,
                "bonus",
                1
            );

            expect(replacementIndex).to.equal(1);
            expect(defaultReplacementIsExplicit).to.equal(false);
            expect(message).to.contain("replaced with bonus 2");
        });

        it("Bonus with game data after still defaults to sequential replacement", () => {
            const appState: AppState = createAppState();

            // Simulate later gameplay so scenario detection sees data after this cycle.
            appState.game.cycles[1].addWrongBuzz(
                { player: players[0], points: -5, position: 0 },
                1,
                appState.game.gameFormat
            );

            const { replacementIndex, defaultReplacementIsExplicit } = getThrowOutQuestionPrompt(
                appState,
                0,
                "bonus",
                1
            );

            // Bonus defaults should still move to the next sequential bonus.
            expect(replacementIndex).to.equal(1);
            expect(defaultReplacementIsExplicit).to.equal(false);
        });
    });
});
