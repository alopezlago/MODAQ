import { CustomizeGameFormatState } from "../state/CustomizeGameFormatState";
import { IGameFormat, IPowerMarker } from "../state/IGameFormat";

const customFormatName = "Custom";

export function changeRegulationTossupCount(
    customizeGameFormatState: CustomizeGameFormatState,
    newValue?: string | undefined
): void {
    const count: number | undefined = getNumberOrUndefined(newValue);
    if (count != undefined) {
        customizeGameFormatState.updateGameFormat({ regulationTossupCount: count });
    }
}

export function changeNegValue(
    customizeGameFormatState: CustomizeGameFormatState,
    newValue?: string | undefined
): void {
    const negValue: number | undefined = getNumberOrUndefined(newValue);
    if (negValue != undefined) {
        customizeGameFormatState.updateGameFormat({ negValue });
    }
}

export function changePowerMarkers(customizeGameFormatState: CustomizeGameFormatState, newValue?: string): void {
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

export function changePowerValues(customizeGameFormatState: CustomizeGameFormatState, newValue?: string): void {
    if (newValue == undefined) {
        return;
    }

    customizeGameFormatState.setPowerValues(newValue);
}

export function changePronunciationGuideMarkers(
    customizeGameFormatState: CustomizeGameFormatState,
    newValue?: string
): void {
    if (newValue == undefined || newValue.trim() === "") {
        customizeGameFormatState.setPronunciationGuideMarkers([]);
        return;
    }

    const guides: string[] = newValue.split(",");
    customizeGameFormatState.setPronunciationGuideMarkers(guides);
}

export function changeMinimumQuestionsInOvertime(
    customizeGameFormatState: CustomizeGameFormatState,
    newValue?: string | undefined
): void {
    const minimumOvertimeQuestionCount: number | undefined = getNumberOrUndefined(newValue);
    if (minimumOvertimeQuestionCount != undefined) {
        customizeGameFormatState.updateGameFormat({ minimumOvertimeQuestionCount });
    }
}

export function changeBounceback(customizeGameFormatState: CustomizeGameFormatState, checked?: boolean): void {
    if (checked == undefined) {
        return;
    }

    customizeGameFormatState.updateGameFormat({ bonusesBounceBack: checked });
}

export function changeOvertimeBonuses(customizeGameFormatState: CustomizeGameFormatState, checked?: boolean): void {
    if (checked == undefined) {
        return;
    }

    customizeGameFormatState?.updateGameFormat({ overtimeIncludesBonuses: checked });
}

export function changePairTossupsBonuses(customizeGameFormatState: CustomizeGameFormatState, checked?: boolean): void {
    if (checked == undefined) {
        return;
    }

    customizeGameFormatState?.updateGameFormat({ pairTossupsBonuses: checked });
}

export function isGameFormatValid(state: CustomizeGameFormatState): boolean {
    if (state == undefined) {
        throw new Error("Tried changing a format with no modified format");
    }

    return (
        state.powerMarkerErrorMessage == undefined &&
        state.powerValuesErrorMessage == undefined &&
        state.pronunciationGuideMarkersErrorMessage == undefined
    );
}

export function normalizeGameFormat(state: CustomizeGameFormatState, oldGameFormat: IGameFormat): void {
    const updatedGameFormat: IGameFormat = { ...state.gameFormat };
    if (updatedGameFormat.displayName !== customFormatName) {
        // TS will complain about implicit any if we use Object.keys to do a deep comparison, so cast the objects as any,
        // and then do a deep comparison
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyUpdatedGameFormat: any = updatedGameFormat as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyExistingGameFormat: any = oldGameFormat as any;

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

    state.updateGameFormat(updatedGameFormat);
}

export function resetGameFormat(customizeGameFormatState: CustomizeGameFormatState, gameFormat: IGameFormat): void {
    customizeGameFormatState.updateGameFormat(gameFormat);
}

export function validatePowerSettings(customizeGameFormatState: CustomizeGameFormatState): void {
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

export function validatePronunicationGuideMarker(customizeGameFormatState: CustomizeGameFormatState): void {
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
