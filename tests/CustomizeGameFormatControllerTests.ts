import { assert, expect } from "chai";

import * as CustomizeGameFormatFormController from "src/components/CustomizeGameFormatFormController";
import * as CustomizeGameFormatDialogController from "src/components/dialogs/CustomGameFormatDialogController";
import * as GameFormats from "src/state/GameFormats";
import { AppState } from "src/state/AppState";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup, Bonus } from "src/state/PacketState";
import { IGameFormat } from "src/state/IGameFormat";
import { CustomizeGameFormatState } from "src/state/CustomizeGameFormatState";

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

// TODO: Make most of these based on the FormController and remove unused DialogController methods

function createApp(): AppState {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    AppState.resetInstance();

    const appState: AppState = AppState.instance;
    appState.game = gameState;
    appState.uiState.dialogState.showCustomizeGameFormatDialog(gameState.gameFormat);

    return appState;
}

function createForm(): CustomizeGameFormatState {
    const appState: AppState = createApp();
    if (appState.uiState.dialogState.customizeGameFormat == undefined) {
        assert.fail("customizeGameFormat was undefined");
    }

    return appState.uiState.dialogState.customizeGameFormat;
}

function verifyNoPowerSettingsErrors(customizeGameFormat: CustomizeGameFormatState): void {
    CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
    expect(customizeGameFormat.powerMarkerErrorMessage).to.be.undefined;
    expect(customizeGameFormat?.powerValuesErrorMessage).to.be.undefined;
}

describe("CustomizeGameFormatControllerTests", () => {
    it("reset format", () => {
        const appState: AppState = createApp();
        appState.game.setGameFormat(GameFormats.PACEGameFormat);
        appState.uiState.dialogState.showCustomizeGameFormatDialog(appState.game.gameFormat);
        expect(appState.uiState.dialogState.customizeGameFormat?.gameFormat).to.deep.equal(GameFormats.PACEGameFormat);

        if (appState.uiState.dialogState.customizeGameFormat == undefined) {
            assert.fail("customizeGameFormat was undefined");
        }

        CustomizeGameFormatFormController.resetGameFormat(
            appState.uiState.dialogState.customizeGameFormat,
            GameFormats.StandardPowersMACFGameFormat
        );
        expect(appState.uiState.dialogState.customizeGameFormat.gameFormat).to.deep.equal(
            GameFormats.StandardPowersMACFGameFormat
        );
    });

    it("changePowerMarkers", () => {
        const customizeGameFormat: CustomizeGameFormatState = createForm();

        CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "[+],(*)");
        expect(customizeGameFormat.powerMarkers).to.deep.equal(["[+]", "(*)"]);
    });

    describe("pronounciationGuideValidation", () => {
        it("No pronunciation guide is valid", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();

            CustomizeGameFormatFormController.changePronunciationGuideMarkers(customizeGameFormat, "");
            CustomizeGameFormatFormController.validatePronunicationGuideMarker(customizeGameFormat);
            expect(customizeGameFormat.pronunciationGuideMarkersErrorMessage).to.be.undefined;
        });
        it("Valid pronunciation guide", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();

            CustomizeGameFormatFormController.changePronunciationGuideMarkers(customizeGameFormat, "<,>");
            CustomizeGameFormatFormController.validatePronunicationGuideMarker(customizeGameFormat);
            expect(customizeGameFormat.pronunciationGuideMarkersErrorMessage).to.be.undefined;
        });
        it("Invalid pronunciation guide (only one side given)", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();

            CustomizeGameFormatFormController.changePronunciationGuideMarkers(customizeGameFormat, "<");
            CustomizeGameFormatFormController.validatePronunicationGuideMarker(customizeGameFormat);
            expect(customizeGameFormat.pronunciationGuideMarkersErrorMessage).to.not.be.undefined;
        });
        it("Invalid pronunciation guide (one side blank)", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();
            CustomizeGameFormatFormController.changePronunciationGuideMarkers(customizeGameFormat, ",>");
            CustomizeGameFormatFormController.validatePronunicationGuideMarker(customizeGameFormat);
            expect(customizeGameFormat.pronunciationGuideMarkersErrorMessage).to.not.be.undefined;
        });
    });

    describe("validatePowerSettings", () => {
        it("Default power settings are valid", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();
            verifyNoPowerSettingsErrors(customizeGameFormat);
        });
        it("Single power setting is valid", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "(*)");
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "15");
            verifyNoPowerSettingsErrors(customizeGameFormat);
        });
        it("Multiple power settings are valid", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "[+],(*)");
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "20, 15");
            verifyNoPowerSettingsErrors(customizeGameFormat);
        });
        it("Invalid power settings (markers but no values)", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "[+],(*)");
            CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
            expect(customizeGameFormat.powerValuesErrorMessage).to.not.be.undefined;
        });
        it("Invalid power settings (more markers than values)", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "[+],(*)");
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "15");
            CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
            expect(customizeGameFormat.powerValuesErrorMessage).to.not.be.undefined;

            // Making the setting valid should clear the error
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "20,15");
            CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
            expect(customizeGameFormat.powerValuesErrorMessage).to.be.undefined;
        });
        it("Invalid power settings (values but no markers)", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "20, 15");
            CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
            expect(customizeGameFormat.powerMarkerErrorMessage).to.not.be.undefined;

            // Making the setting valid should clear the error
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "*,+");
            CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
            expect(customizeGameFormat.powerMarkerErrorMessage).to.be.undefined;
        });
        it("Invalid power settings (more markers than values)", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "(*)");
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "20, 15");
            CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
            expect(customizeGameFormat.powerMarkerErrorMessage).to.not.be.undefined;
        });
        it("Invalid power settings (non-numeric power value))", () => {
            const customizeGameFormat: CustomizeGameFormatState = createForm();
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "(*)");
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "a26z");
            CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
            expect(customizeGameFormat.powerValuesErrorMessage).to.not.be.undefined;
        });
    });

    describe("submit", () => {
        it("submit default form works", () => {
            const appState: AppState = createApp();
            const oldGameFormat: IGameFormat = appState.game.gameFormat;
            CustomizeGameFormatDialogController.submit();

            expect(appState.uiState.dialogState.customizeGameFormat).to.be.undefined;
            expect(appState.game.gameFormat).to.deep.equal(oldGameFormat);
        });
        it("submit updates game format", () => {
            const appState: AppState = createApp();

            if (appState.uiState.dialogState.customizeGameFormat == undefined) {
                assert.fail("customizeGameFormat is undefined");
            }

            const customizeGameFormat: CustomizeGameFormatState = appState.uiState.dialogState.customizeGameFormat;

            const oldGameFormat: IGameFormat = appState.game.gameFormat;
            CustomizeGameFormatFormController.changeBounceback(customizeGameFormat, true);
            CustomizeGameFormatFormController.changeMinimumQuestionsInOvertime(customizeGameFormat, "10");
            CustomizeGameFormatFormController.changeNegValue(customizeGameFormat, "-10");
            CustomizeGameFormatFormController.changeOvertimeBonuses(customizeGameFormat, true);
            CustomizeGameFormatFormController.changePairTossupsBonuses(customizeGameFormat, true);
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "<*>");
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "25");
            CustomizeGameFormatFormController.changePronunciationGuideMarkers(customizeGameFormat, "[,]");
            CustomizeGameFormatFormController.changeRegulationTossupCount(customizeGameFormat, "15");
            CustomizeGameFormatDialogController.submit();

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

            if (appState.uiState.dialogState.customizeGameFormat == undefined) {
                assert.fail("customizeGameFormat is undefined");
            }

            const customizeGameFormat: CustomizeGameFormatState = appState.uiState.dialogState.customizeGameFormat;

            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "(*),[+]");
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "15,20");
            CustomizeGameFormatDialogController.submit();

            expect(appState.uiState.dialogState.customizeGameFormat).to.be.undefined;
            expect(appState.game.gameFormat.powers).to.deep.equal([
                { marker: "[+]", points: 20 },
                { marker: "(*)", points: 15 },
            ]);
        });
        it("submit does nothing with invalid power value settings", () => {
            const appState: AppState = createApp();

            if (appState.uiState.dialogState.customizeGameFormat == undefined) {
                assert.fail("customizeGameFormat is undefined");
            }

            const customizeGameFormat: CustomizeGameFormatState = appState.uiState.dialogState.customizeGameFormat;

            const oldGameFormat: IGameFormat = appState.game.gameFormat;
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "(*)");
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "a26z");
            CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
            CustomizeGameFormatDialogController.submit();

            expect(appState.uiState.dialogState.customizeGameFormat?.powerValuesErrorMessage).to.not.be.undefined;
            expect(appState.uiState.dialogState.customizeGameFormat).to.not.be.undefined;
            expect(appState.game.gameFormat).to.equal(oldGameFormat);
        });
        it("submit does nothing with invalid power marker settings", () => {
            const appState: AppState = createApp();
            if (appState.uiState.dialogState.customizeGameFormat == undefined) {
                assert.fail("customizeGameFormat is undefined");
            }

            const customizeGameFormat: CustomizeGameFormatState = appState.uiState.dialogState.customizeGameFormat;

            const oldGameFormat: IGameFormat = appState.game.gameFormat;
            CustomizeGameFormatFormController.changePowerMarkers(customizeGameFormat, "(*)");
            CustomizeGameFormatFormController.changePowerValues(customizeGameFormat, "25,20");
            CustomizeGameFormatFormController.validatePowerSettings(customizeGameFormat);
            CustomizeGameFormatDialogController.submit();

            expect(appState.uiState.dialogState.customizeGameFormat?.powerMarkerErrorMessage).to.not.be.undefined;
            expect(appState.uiState.dialogState.customizeGameFormat).to.not.be.undefined;
            expect(appState.game.gameFormat).to.equal(oldGameFormat);
        });
    });
});
