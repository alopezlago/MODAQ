import { IGameFormat, IPowerMarker } from "./IGameFormat";

// We can't rely on a currentVersion we fill in, so these have to be manually tracked if there are breaking changes

const currentVersion = "2021-07-11";

export const ACFGameFormat: IGameFormat = {
    bonusesBounceBack: false,
    displayName: "ACF",
    minimumOvertimeQuestionCount: 1,
    overtimeIncludesBonuses: false,
    negValue: -5,
    powers: [],
    regulationTossupCount: 20,
    timeoutsAllowed: 1,
    pronunciationGuideMarkers: ["(", ")"],
    pairTossupsBonuses: false,
    version: currentVersion,
};

export const PACEGameFormat: IGameFormat = {
    bonusesBounceBack: false,
    displayName: "PACE",
    minimumOvertimeQuestionCount: 1,
    overtimeIncludesBonuses: false,
    negValue: 0,
    powers: [{ marker: "(*)", points: 20 }],
    regulationTossupCount: 20,
    timeoutsAllowed: 1,
    pronunciationGuideMarkers: ["(", ")"],
    pairTossupsBonuses: false,
    version: currentVersion,
};

export const StandardPowersMACFGameFormat: IGameFormat = {
    ...createMACFGameFormat([{ marker: "(*)", points: 15 }]),
    displayName: "mACF with powers",
};

export const UndefinedGameFormat: IGameFormat = {
    bonusesBounceBack: false,
    displayName: "Freeform format",
    minimumOvertimeQuestionCount: 1,
    overtimeIncludesBonuses: false,
    negValue: -5,
    powers: [{ marker: "(*)", points: 15 }],
    regulationTossupCount: 999,
    timeoutsAllowed: 999,
    pronunciationGuideMarkers: ["(", ")"],
    pairTossupsBonuses: false,
    version: currentVersion,
};

export function getKnownFormats(): IGameFormat[] {
    return [ACFGameFormat, StandardPowersMACFGameFormat, PACEGameFormat, UndefinedGameFormat];
}

export function createMACFGameFormat(powers: IPowerMarker[]): IGameFormat {
    return {
        ...ACFGameFormat,
        powers,
    };
}

export function getUpgradedFormatVersion(format: IGameFormat): IGameFormat {
    if (format.version === currentVersion) {
        return format;
    }

    updatePowerMarkers(format);

    // We need to compare the fields between the given format and the current format, so we need to iterate over them.
    // This requires using the array/dictionary syntax for accessing fields, which requires using any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultFormat: any = UndefinedGameFormat as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatObject: any = format as any;
    for (const key of Object.keys(defaultFormat)) {
        if (key === "displayName" || key === "pronunciationGuideMarkers") {
            continue;
        }

        if (formatObject[key] == undefined) {
            throwInvalidGameFormatError(
                `Game format uses an incompatible version (${format.version}). Unknown setting "${key}".`
            );
        } else if (typeof formatObject[key] !== typeof defaultFormat[key]) {
            throwInvalidGameFormatError(
                `Game format uses an incompatible version (${format.version}). "${key}" is an incompatible type.`
            );
        }
    }

    return format;
}

function updatePowerMarkers(gameFormat: IGameFormat): void {
    if (
        gameFormat.powers != undefined ||
        gameFormat.pointsForPowers == undefined ||
        gameFormat.powerMarkers == undefined
    ) {
        return;
    }

    if (gameFormat.powerMarkers.length < gameFormat.pointsForPowers.length) {
        throwInvalidGameFormatError("Game format is invalid. Some power markers don't have point values.");
    }

    gameFormat.powers = [];
    for (let i = 0; i < gameFormat.powerMarkers.length; i++) {
        gameFormat.powers.push({
            marker: gameFormat.powerMarkers[i],
            points: gameFormat.pointsForPowers[i],
        });
    }
}

function throwInvalidGameFormatError(message: string): void {
    throw new Error(`${message}. Export your game and see if you can update your format manually, or reset your game`);
}
