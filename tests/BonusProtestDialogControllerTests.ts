import { assert, expect } from "chai";

import * as BonusProtestDialogController from "src/components/dialogs/BonusProtestDialogController";
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

function initializeApp(buzzerProtests = true): AppState {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    const defaultExistingPlayers: Player[] = [
        new Player("Frank", defaultTeamNames[0], true),
        new Player("Faye", defaultTeamNames[0], true),
        new Player("Saul", defaultTeamNames[1], true),
    ];
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
    if (!buzzerProtests) {
        appState.game.cycles[0].setBonusPartAnswer(0, buzzer.teamName, 10);
    }

    appState.uiState.setPendingBonusProtest(protestTeamName, 0, 0);
    return appState;
}

describe("BonusQuestionDialogControllerTests", () => {
    function verifyBasicProtest(buzzerProtests: boolean): void {
        const givenAnswer = "My answer";
        const reason = "It is factually wrong";
        const appState: AppState = initializeApp(buzzerProtests);

        if (appState.uiState.pendingBonusProtestEvent == undefined) {
            assert.fail("Test wasn't initialized correctly");
        }

        appState.uiState.pendingBonusProtestEvent.givenAnswer = givenAnswer;
        appState.uiState.pendingBonusProtestEvent.reason = reason;

        const protestCycle: Cycle = appState.game.cycles[0];
        BonusProtestDialogController.commit(protestCycle);

        if (protestCycle.bonusProtests == undefined) {
            assert.fail("Bonus protests were undefined");
        }

        expect(protestCycle.bonusProtests.length).to.equal(1);

        const protest = protestCycle.bonusProtests[0];
        expect(protest.partIndex).to.equal(0);
        expect(protest.questionIndex).to.equal(0);
        expect(protest.givenAnswer).to.equal(givenAnswer);
        expect(protest.reason).to.equal(reason);

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

        const appState: AppState = initializeApp(false);

        // Add an existing protest
        appState.game.cycles[0].addBonusProtest(0, 1, firstGivenAnswer, firstReason, defaultTeamNames[0]);

        if (appState.uiState.pendingBonusProtestEvent == undefined) {
            assert.fail("Test wasn't initialized correctly");
        }

        appState.uiState.pendingBonusProtestEvent.givenAnswer = secondGivenAnswer;
        appState.uiState.pendingBonusProtestEvent.reason = secondReason;

        const protestCycle: Cycle = appState.game.cycles[0];
        BonusProtestDialogController.commit(protestCycle);

        if (protestCycle.bonusProtests == undefined) {
            assert.fail("Bonus protests were undefined");
        }

        expect(protestCycle.bonusProtests.length).to.equal(2);

        const originalProtest = protestCycle.bonusProtests[0];
        expect(originalProtest.partIndex).to.equal(1);
        expect(originalProtest.questionIndex).to.equal(0);
        expect(originalProtest.givenAnswer).to.equal(firstGivenAnswer);
        expect(originalProtest.reason).to.equal(firstReason);
        expect(originalProtest.teamName).to.equal(defaultTeamNames[0]);

        const newProtest = protestCycle.bonusProtests[1];
        expect(newProtest.partIndex).to.equal(0);
        expect(newProtest.questionIndex).to.equal(0);
        expect(newProtest.givenAnswer).to.equal(secondGivenAnswer);
        expect(newProtest.reason).to.equal(secondReason);
        expect(newProtest.teamName).to.equal(defaultTeamNames[1]);
    });

    it("change part", () => {
        const givenAnswer = "My answer";
        const reason = "It is factually wrong";
        const appState: AppState = initializeApp(true);

        if (appState.uiState.pendingBonusProtestEvent == undefined) {
            assert.fail("Test wasn't initialized correctly");
        }

        appState.uiState.pendingBonusProtestEvent.givenAnswer = givenAnswer;
        appState.uiState.pendingBonusProtestEvent.reason = reason;

        BonusProtestDialogController.changePart(1);

        const protestCycle: Cycle = appState.game.cycles[0];
        BonusProtestDialogController.commit(protestCycle);

        if (protestCycle.bonusProtests == undefined) {
            assert.fail("Bonus protests were undefined");
        }

        expect(protestCycle.bonusProtests.length).to.equal(1);

        const protest = protestCycle.bonusProtests[0];
        expect(protest.partIndex).to.equal(1);
        expect(protest.questionIndex).to.equal(0);
        expect(protest.givenAnswer).to.equal(givenAnswer);
        expect(protest.reason).to.equal(reason);

        expect(protest.teamName).to.equal(defaultTeamNames[0]);
    });

    it("hideDialog", () => {
        const appState: AppState = initializeApp();
        expect(appState.uiState.pendingBonusProtestEvent).to.not.be.undefined;

        BonusProtestDialogController.cancel();

        expect(appState.uiState.pendingBonusProtestEvent).to.be.undefined;
    });
});
