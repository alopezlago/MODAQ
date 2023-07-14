import { expect } from "chai";

import * as CustomizeGameFormatController from "src/components/dialogs/CustomGameFormatDialogController";
import * as GameFormats from "src/state/GameFormats";
import { AppState } from "src/state/AppState";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup, Bonus } from "src/state/PacketState";
import { IGameFormat } from "src/state/IGameFormat";

const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([new Tossup("first q", "first a"), new Tossup("second q", "second a")]);
defaultPacket.setBonuses([
    new Bonus("first leadin", [
        { question: "first q", answer: "first a", value: 10 },
        { question: "first q 2", answer: "first a 2", value: 10 },
        { question: "first q 3", answer: "first a 3", value: 10 },
    ]),
    new Bonus("second leadin", [
        { question: "second q", answer: "second a", value: 10 },
        { question: "second q 2", answer: "second a 2", value: 10 },
        { question: "second q 3", answer: "second a 3", value: 10 },
    ]),
]);

function createApp(): AppState {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    const appState: AppState = new AppState();
    appState.game = gameState;
    appState.uiState.dialogState.showCustomizeGameFormatDialog(gameState.gameFormat);

    return appState;
}

function verifyNoPowerSettingsErrors(appState: AppState): void {
    CustomizeGameFormatController.validatePowerSettings(appState);
    expect(appState.uiState.dialogState.customizeGameFormat?.powerMarkerErrorMessage).to.be.undefined;
    expect(appState.uiState.dialogState.customizeGameFormat?.powerValuesErrorMessage).to.be.undefined;
}

describe("CustomizeGameFormatControllerTests", () => {
    it("reset format", () => {
        const appState: AppState = createApp();
        appState.game.setGameFormat(GameFormats.PACEGameFormat);
        appState.uiState.dialogState.showCustomizeGameFormatDialog(appState.game.gameFormat);
        expect(appState.uiState.dialogState.customizeGameFormat?.gameFormat).to.deep.equal(GameFormats.PACEGameFormat);

        CustomizeGameFormatController.resetGameFormat(appState, GameFormats.StandardPowersMACFGameFormat);
        expect(appState.uiState.dialogState.customizeGameFormat?.gameFormat).to.deep.equal(
            GameFormats.StandardPowersMACFGameFormat
        );
    });

    it("changePowerMarkers", () => {
        const appState: AppState = createApp();
        CustomizeGameFormatController.changePowerMarkers(appState, "[+],(*)");
        expect(appState.uiState.dialogState.customizeGameFormat?.powerMarkers).to.deep.equal(["[+]", "(*)"]);
    });

    describe("pronounciationGuideValidation", () => {
        it("No pronunciation guide is valid", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePronunciationGuideMarkers(appState, "");
            CustomizeGameFormatController.validatePronunicationGuideMarker(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.pronunciationGuideMarkersErrorMessage).to.be
                .undefined;
        });
        it("Valid pronunciation guide", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePronunciationGuideMarkers(appState, "<,>");
            CustomizeGameFormatController.validatePronunicationGuideMarker(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.pronunciationGuideMarkersErrorMessage).to.be
                .undefined;
        });
        it("Invalid pronunciation guide (only one side given)", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePronunciationGuideMarkers(appState, "<");
            CustomizeGameFormatController.validatePronunicationGuideMarker(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.pronunciationGuideMarkersErrorMessage).to.not.be
                .undefined;
        });
        it("Invalid pronunciation guide (one side blank)", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePronunciationGuideMarkers(appState, ",>");
            CustomizeGameFormatController.validatePronunicationGuideMarker(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.pronunciationGuideMarkersErrorMessage).to.not.be
                .undefined;
        });
    });

    describe("validatePowerSettings", () => {
        it("Default power settings are valid", () => {
            const appState: AppState = createApp();
            verifyNoPowerSettingsErrors(appState);
        });
        it("Single power setting is valid", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePowerMarkers(appState, "(*)");
            CustomizeGameFormatController.changePowerValues(appState, "15");
            verifyNoPowerSettingsErrors(appState);
        });
        it("Multiple power settings are valid", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePowerMarkers(appState, "[+],(*)");
            CustomizeGameFormatController.changePowerValues(appState, "20, 15");
            verifyNoPowerSettingsErrors(appState);
        });
        it("Invalid power settings (markers but no values)", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePowerMarkers(appState, "[+],(*)");
            CustomizeGameFormatController.validatePowerSettings(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.powerValuesErrorMessage).to.not.be.undefined;
        });
        it("Invalid power settings (more markers than values)", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePowerMarkers(appState, "[+],(*)");
            CustomizeGameFormatController.changePowerValues(appState, "15");
            CustomizeGameFormatController.validatePowerSettings(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.powerValuesErrorMessage).to.not.be.undefined;

            // Making the setting valid should clear the error
            CustomizeGameFormatController.changePowerValues(appState, "20,15");
            CustomizeGameFormatController.validatePowerSettings(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.powerValuesErrorMessage).to.be.undefined;
        });
        it("Invalid power settings (values but no markers)", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePowerValues(appState, "20, 15");
            CustomizeGameFormatController.validatePowerSettings(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.powerMarkerErrorMessage).to.not.be.undefined;

            // Making the setting valid should clear the error
            CustomizeGameFormatController.changePowerMarkers(appState, "*,+");
            CustomizeGameFormatController.validatePowerSettings(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.powerMarkerErrorMessage).to.be.undefined;
        });
        it("Invalid power settings (more markers than values)", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePowerMarkers(appState, "(*)");
            CustomizeGameFormatController.changePowerValues(appState, "20, 15");
            CustomizeGameFormatController.validatePowerSettings(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.powerMarkerErrorMessage).to.not.be.undefined;
        });
        it("Invalid power settings (non-numeric power value))", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePowerMarkers(appState, "(*)");
            CustomizeGameFormatController.changePowerValues(appState, "a26z");
            CustomizeGameFormatController.validatePowerSettings(appState);
            expect(appState.uiState.dialogState.customizeGameFormat?.powerValuesErrorMessage).to.not.be.undefined;
        });
    });

    describe("submit", () => {
        it("submit default form works", () => {
            const appState: AppState = createApp();
            const oldGameFormat: IGameFormat = appState.game.gameFormat;
            CustomizeGameFormatController.submit(appState);

            expect(appState.uiState.dialogState.customizeGameFormat).to.be.undefined;
            expect(appState.game.gameFormat).to.deep.equal(oldGameFormat);
        });
        it("submit updates game format", () => {
            const appState: AppState = createApp();
            const oldGameFormat: IGameFormat = appState.game.gameFormat;
            CustomizeGameFormatController.changeBounceback(appState, true);
            CustomizeGameFormatController.changeMinimumQuestionsInOvertime(appState, "10");
            CustomizeGameFormatController.changeNegValue(appState, "-10");
            CustomizeGameFormatController.changeOvertimeBonuses(appState, true);
            CustomizeGameFormatController.changePairTossupsBonuses(appState, true);
            CustomizeGameFormatController.changePowerMarkers(appState, "<*>");
            CustomizeGameFormatController.changePowerValues(appState, "25");
            CustomizeGameFormatController.changePronunciationGuideMarkers(appState, "[,]");
            CustomizeGameFormatController.changeRegulationTossupCount(appState, "15");
            CustomizeGameFormatController.submit(appState);

            expect(appState.uiState.dialogState.customizeGameFormat).to.be.undefined;

            const expectedGameFormat: IGameFormat = {
                ...oldGameFormat,
                bonusesBounceBack: true,
                displayName: "Custom",
                minimumOvertimeQuestionCount: 10,
                negValue: -10,
                overtimeIncludesBonuses: true,
                pairTossupsBonuses: true,
                powers: [{ marker: "<*>", points: 25 }],
                regulationTossupCount: 15,
                pronunciationGuideMarkers: ["[", "]"],
            };
            expect(appState.game.gameFormat).to.deep.equal(expectedGameFormat);
        });
        it("submit has powers sorted", () => {
            const appState: AppState = createApp();
            CustomizeGameFormatController.changePowerMarkers(appState, "(*),[+]");
            CustomizeGameFormatController.changePowerValues(appState, "15,20");
            CustomizeGameFormatController.submit(appState);

            expect(appState.uiState.dialogState.customizeGameFormat).to.be.undefined;
            expect(appState.game.gameFormat.powers).to.deep.equal([
                { marker: "[+]", points: 20 },
                { marker: "(*)", points: 15 },
            ]);
        });
        it("submit does nothing with invalid power value settings", () => {
            const appState: AppState = createApp();
            const oldGameFormat: IGameFormat = appState.game.gameFormat;
            CustomizeGameFormatController.changePowerMarkers(appState, "(*)");
            CustomizeGameFormatController.changePowerValues(appState, "a26z");
            CustomizeGameFormatController.validatePowerSettings(appState);
            CustomizeGameFormatController.submit(appState);

            expect(appState.uiState.dialogState.customizeGameFormat?.powerValuesErrorMessage).to.not.be.undefined;
            expect(appState.uiState.dialogState.customizeGameFormat).to.not.be.undefined;
            expect(appState.game.gameFormat).to.equal(oldGameFormat);
        });
        it("submit does nothing with invalid power marker settings", () => {
            const appState: AppState = createApp();
            const oldGameFormat: IGameFormat = appState.game.gameFormat;
            CustomizeGameFormatController.changePowerMarkers(appState, "(*)");
            CustomizeGameFormatController.changePowerValues(appState, "25,20");
            CustomizeGameFormatController.validatePowerSettings(appState);
            CustomizeGameFormatController.submit(appState);

            expect(appState.uiState.dialogState.customizeGameFormat?.powerMarkerErrorMessage).to.not.be.undefined;
            expect(appState.uiState.dialogState.customizeGameFormat).to.not.be.undefined;
            expect(appState.game.gameFormat).to.equal(oldGameFormat);
        });
    });
});
