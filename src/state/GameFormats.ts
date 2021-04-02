import { IGameFormat } from "./IGameFormat";

declare const __BUILD_VERSION__: string;

export const ACFGameFormat: IGameFormat = {
    bonusesBounceBack: false,
    displayName: "ACF",
    minimumOvertimeQuestionCount: 1,
    overtimeIncludesBonuses: false,
    negValue: -5,
    pointsForPowers: [],
    powerMarkers: [],
    regulationTossupCount: 20,
    timeoutsAllowed: 1,
    version: __BUILD_VERSION__,
};

export const StandardPowersMACFGameFormat: IGameFormat = {
    ...createMACFGameFormat([15], ["(*)"]),
    displayName: "mACF with powers",
};

export const UndefinedGameFormat: IGameFormat = {
    bonusesBounceBack: false,
    displayName: "Sample format",
    minimumOvertimeQuestionCount: 1,
    overtimeIncludesBonuses: false,
    negValue: -5,
    pointsForPowers: [15],
    powerMarkers: ["(*)"],
    regulationTossupCount: 999,
    timeoutsAllowed: 999,
    version: __BUILD_VERSION__,
};

export function getKnownFormats(): IGameFormat[] {
    return [ACFGameFormat, StandardPowersMACFGameFormat, UndefinedGameFormat];
}

export function createMACFGameFormat(pointsForPowers: number[], powerMarkers: string[]): IGameFormat {
    return {
        ...ACFGameFormat,
        pointsForPowers,
        powerMarkers,
    };
}

export function getUpgradedFormatVersion(format: IGameFormat): IGameFormat {
    if (format.version === __BUILD_VERSION__) {
        return format;
    }

    // We need to compare the fields between the given format and the current format, so we need to iterate over them.
    // This requires using the array/dictionary syntax for accessing fields, which requires using any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultFormat: any = UndefinedGameFormat as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatObject: any = format as any;
    for (const key of Object.keys(defaultFormat)) {
        if (key === "displayName") {
            continue;
        }

        if (formatObject[key] == undefined) {
            throw new Error(
                `Game format uses an incompatible version (${format.version}). Unknown setting "${key}". Export your game and see if you can update your format manually, or reset your game`
            );
        } else if (typeof formatObject[key] !== typeof defaultFormat[key]) {
            throw new Error(
                `Game format uses an incompatible version (${format.version}). "${key}" is an incompatible type. Export your game and see if you can update your format manually, or reset your game`
            );
        }
    }

    return format;
}
