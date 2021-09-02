import { AppState } from "src/state/AppState";
import { CustomizeGameFormatDialogState } from "src/state/CustomizeGameFormatDialogState";
import { GameState } from "src/state/GameState";
import { IGameFormat, IPowerMarker } from "src/state/IGameFormat";

const customFormatName = "Custom";

export function cancel(appState: AppState): void {
    hideDialog(appState);
}

export function submit(appState: AppState): void {
    const game: GameState = appState.game;
    const state: CustomizeGameFormatDialogState | undefined = appState.uiState.dialogState.customizeGameFormat;
    if (state == undefined) {
        throw new Error("Tried customizing a game format with no game format");
    }

    if (!isGameFormatValid(appState)) {
        // We should already have the error repored, so just do nothing
        return;
    }

    const updatedGameFormat: IGameFormat = state.gameFormat;
    if (updatedGameFormat.displayName !== customFormatName) {
        // TS will complain about implicit any if we use Object.keys to do a deep comparison, so cast the objects as any,
        // and then do a deep comparison
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyUpdatedGameFormat: any = updatedGameFormat as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyExistingGameFormat: any = game.gameFormat as any;

        for (const key of Object.keys(updatedGameFormat)) {
            if (anyUpdatedGameFormat[key] !== anyExistingGameFormat[key]) {
                updatedGameFormat.displayName = customFormatName;
                break;
            }
        }
    }

    // Power values should be in descending order, so sort them before saving the game format
    const powers: IPowerMarker[] = [];
    const powerValues: number[] = state.powerValues.split(",").map((value) => parseInt(value, 10));
    for (let i = 0; i < state.powerMarkers.length; i++) {
        powers.push({ marker: state.powerMarkers[i], points: powerValues[i] });
    }

    powers.sort(sortPowersDescending);
    updatedGameFormat.powers = powers;

    if (state.pronunicationGuideMarkers == undefined || state.pronunicationGuideMarkers.length === 0) {
        updatedGameFormat.pronunciationGuideMarkers = undefined;
    } else if (
        state.pronunicationGuideMarkers.length === 2 &&
        state.pronunicationGuideMarkers.every((value) => value.length > 0)
    ) {
        updatedGameFormat.pronunciationGuideMarkers = [
            state.pronunicationGuideMarkers[0],
            state.pronunicationGuideMarkers[1],
        ];
    }

    game.setGameFormat(updatedGameFormat);

    hideDialog(appState);
}

export function changeRegulationTossupCount(appState: AppState, newValue?: string | undefined): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);
    const count: number | undefined = getNumberOrUndefined(newValue);
    if (count != undefined) {
        customizeGameFormatState.updateGameFormat({ regulationTossupCount: count });
    }
}

export function changeNegValue(appState: AppState, newValue?: string | undefined): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);
    const negValue: number | undefined = getNumberOrUndefined(newValue);
    if (negValue != undefined) {
        customizeGameFormatState.updateGameFormat({ negValue });
    }
}

export function changePowerMarkers(appState: AppState, newValue?: string): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);
    if (newValue == undefined) {
        return;
    } else if (newValue.trim() === "") {
        customizeGameFormatState.setPowerMarkers([]);
        return;
    }

    // TODO: Handle power markers with commas, which would require handling escapes
    const powerMarkers: string[] = newValue.split(",").map((value) => value.trim());
    customizeGameFormatState.setPowerMarkers(powerMarkers);
}

export function changePowerValues(appState: AppState, newValue?: string): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);
    if (newValue == undefined) {
        return;
    }

    customizeGameFormatState.setPowerValues(newValue);
}

export function changePronunciationGuideMarkers(appState: AppState, newValue?: string): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);
    if (newValue == undefined || newValue.trim() === "") {
        customizeGameFormatState.setPronunciationGuideMarkers([]);
        return;
    }

    const guides: string[] = newValue.split(",");
    customizeGameFormatState.setPronunciationGuideMarkers(guides);
}

export function changeMinimumQuestionsInOvertime(appState: AppState, newValue?: string | undefined): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);
    const minimumOvertimeQuestionCount: number | undefined = getNumberOrUndefined(newValue);
    if (minimumOvertimeQuestionCount != undefined) {
        customizeGameFormatState.updateGameFormat({ minimumOvertimeQuestionCount });
    }
}

export function changeBounceback(appState: AppState, checked?: boolean): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);
    if (checked == undefined) {
        return;
    }

    customizeGameFormatState.updateGameFormat({ bonusesBounceBack: checked });
}

export function changeOvertimeBonuses(appState: AppState, checked?: boolean): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);
    if (checked == undefined) {
        return;
    }

    customizeGameFormatState?.updateGameFormat({ overtimeIncludesBonuses: checked });
}

export function resetGameFormat(appState: AppState, gameFormat: IGameFormat): void {
    appState.uiState.dialogState.customizeGameFormat?.updateGameFormat(gameFormat);
}

export function validatePowerSettings(appState: AppState): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);

    customizeGameFormatState.clearPowerErrorMessages();
    const powerValues: number[] = customizeGameFormatState.powerValues.split(",").map((value) => parseInt(value, 10));

    if (customizeGameFormatState.powerMarkers.length < powerValues.length) {
        customizeGameFormatState.setPowerMarkerErrorMessage(
            "More power markers needed. The number of power markers and values must be the same."
        );
    } else if (powerValues.length < customizeGameFormatState.powerMarkers.length) {
        customizeGameFormatState.setPowerValuesErrorMessage(
            "More values needed. The number of power markers and values must be the same."
        );
    } else if (powerValues.some((value) => isNaN(value))) {
        customizeGameFormatState.setPowerValuesErrorMessage("Power values must be integers.");
    }
}

export function validatePronunicationGuideMarker(appState: AppState): void {
    const customizeGameFormatState: CustomizeGameFormatDialogState = getState(appState);
    const pronunciationGuideMarkers: string[] | undefined = customizeGameFormatState.pronunicationGuideMarkers;
    if (pronunciationGuideMarkers == undefined) {
        return;
    }

    if (pronunciationGuideMarkers.length !== 0 && pronunciationGuideMarkers.length !== 2) {
        customizeGameFormatState.setPronunciationGuideMarkersErrorMessage(
            "Either no pronunciation guide is used, or there only needs to be a start and end marker specifeid"
        );
    } else if (pronunciationGuideMarkers.some((value) => value.length === 0)) {
        customizeGameFormatState.setPronunciationGuideMarkersErrorMessage(
            "Pronunciation guide markers cannot be empty; put a character before or after the comma"
        );
    } else {
        customizeGameFormatState.clearPronunciationGuideMarkersErrorMessage();
    }
}

function getState(appState: AppState): CustomizeGameFormatDialogState {
    const state: CustomizeGameFormatDialogState | undefined = appState.uiState.dialogState.customizeGameFormat;
    if (state == undefined) {
        throw new Error("Tried customizing a game format with no game format");
    }

    return state;
}

function getNumberOrUndefined(value: string | undefined): number | undefined {
    if (value == undefined) {
        return undefined;
    }

    const number = Number.parseInt(value, 10);
    return isNaN(number) ? undefined : number;
}

function sortPowersDescending(left: IPowerMarker, right: IPowerMarker): number {
    return right.points - left.points;
}

function isGameFormatValid(appState: AppState): boolean {
    const state: CustomizeGameFormatDialogState | undefined = appState.uiState.dialogState.customizeGameFormat;
    if (state == undefined) {
        throw new Error("Tried changing a format with no modified format");
    }

    return (
        state.powerMarkerErrorMessage == undefined &&
        state.powerValuesErrorMessage == undefined &&
        state.pronunciationGuideMarkersErrorMessage == undefined
    );
}

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideCustomizeGameFormatDialog();
}
