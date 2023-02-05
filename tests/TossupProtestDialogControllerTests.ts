import { assert, expect } from "chai";

import * as TossupProtestDialogController from "src/components/dialogs/TossupProtestDialogController";
import * as GameFormats from "src/state/GameFormats";
import { AppState } from "src/state/AppState";
import { GameState } from "src/state/GameState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";
import { Cycle } from "src/state/Cycle";

const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([new Tossup("first q", "first a"), new Tossup("second q", "second a")]);
defaultPacket.setBonuses([new Bonus("Leadin", [])]);

const defaultTeamNames: string[] = ["First Team", "Team2"];
const defaultExistingPlayers: Player[] = [
    new Player("Frank", defaultTeamNames[0], true),
    new Player("Faye", defaultTeamNames[0], true),
    new Player("Saul", defaultTeamNames[1], true),
];

function initializeApp(buzzerProtests = true): AppState {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    gameState.addPlayers(defaultExistingPlayers);

    AppState.resetInstance();
    const appState: AppState = AppState.instance;
    appState.game = gameState;

    const buzzer: Player = defaultExistingPlayers[0];
    appState.game.cycles[0].addCorrectBuzz(
        { player: buzzer, position: 100, points: 10 },
        0,
        GameFormats.UndefinedGameFormat,
        0,
        3
    );

    const protestTeamName = buzzerProtests ? buzzer.teamName : defaultTeamNames[1];
    appState.uiState.setPendingTossupProtest(protestTeamName, 0, 100);
    return appState;
}

describe("BonusQuestionDialogControllerTests", () => {
    function verifyBasicProtest(buzzerProtests: boolean): void {
        const givenAnswer = "My answer";
        const reason = "It is factually wrong";
        const appState: AppState = initializeApp(buzzerProtests);

        if (appState.uiState.pendingTossupProtestEvent == undefined) {
            assert.fail("Test wasn't initialized correctly");
        }

        appState.uiState.pendingTossupProtestEvent.givenAnswer = givenAnswer;
        appState.uiState.pendingTossupProtestEvent.reason = reason;

        const protestCycle: Cycle = appState.game.cycles[0];
        TossupProtestDialogController.commit(protestCycle);

        if (protestCycle.tossupProtests == undefined) {
            assert.fail("Bonus protests were undefined");
        }

        expect(protestCycle.tossupProtests.length).to.equal(1);

        const protest = protestCycle.tossupProtests[0];
        expect(protest.questionIndex).to.equal(0);
        expect(protest.givenAnswer).to.equal(givenAnswer);
        expect(protest.reason).to.equal(reason);
        expect(protest.position).to.equal(100);

        const teamName: string = buzzerProtests ? defaultTeamNames[0] : defaultTeamNames[1];
        expect(protest.teamName).to.equal(teamName);
    }

    it("correct team protests bonus", () => {
        verifyBasicProtest(true);
    });

    it("other team protests bonus", () => {
        verifyBasicProtest(false);
    });

    it("Multiple protests", () => {
        const firstGivenAnswer = "My answer";
        const secondGivenAnswer = "Other answer";
        const firstReason = "It is factually wrong";
        const secondReason = "You were wrong";

        const appState: AppState = initializeApp(true);
        const cycle: Cycle = appState.game.cycles[0];

        cycle.addWrongBuzz(
            { player: defaultExistingPlayers[2], position: 50, points: 0 },
            0,
            GameFormats.UndefinedGameFormat
        );

        // Add an existing protest
        cycle.addTossupProtest(defaultTeamNames[1], 0, 50, firstGivenAnswer, firstReason);

        if (appState.uiState.pendingTossupProtestEvent == undefined) {
            assert.fail("Test wasn't initialized correctly");
        }

        appState.uiState.pendingTossupProtestEvent.givenAnswer = secondGivenAnswer;
        appState.uiState.pendingTossupProtestEvent.reason = secondReason;

        TossupProtestDialogController.commit(cycle);

        if (cycle.tossupProtests == undefined) {
            assert.fail("Bonus protests were undefined");
        }

        expect(cycle.tossupProtests.length).to.equal(2);

        const originalProtest = cycle.tossupProtests[0];
        expect(originalProtest.questionIndex).to.equal(0);
        expect(originalProtest.givenAnswer).to.equal(firstGivenAnswer);
        expect(originalProtest.reason).to.equal(firstReason);
        expect(originalProtest.teamName).to.equal(defaultTeamNames[1]);
        expect(originalProtest.position).to.equal(50);

        const newProtest = cycle.tossupProtests[1];
        expect(newProtest.questionIndex).to.equal(0);
        expect(newProtest.givenAnswer).to.equal(secondGivenAnswer);
        expect(newProtest.reason).to.equal(secondReason);
        expect(newProtest.teamName).to.equal(defaultTeamNames[0]);
        expect(newProtest.position).to.equal(100);
    });

    it("hideDialog", () => {
        const appState: AppState = initializeApp();
        expect(appState.uiState.pendingTossupProtestEvent).to.not.be.undefined;

        TossupProtestDialogController.cancel();

        expect(appState.uiState.pendingTossupProtestEvent).to.be.undefined;
    });
});
