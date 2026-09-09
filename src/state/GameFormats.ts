import { IGameFormat, IPowerMarker } from "./IGameFormat";

// We can't rely on a currentVersion we fill in, so these have to be manually tracked if there are breaking changes

const currentVersion = "2024-03-20";

export const ACFGameFormat: IGameFormat = {
    bonusesBounceBack: false,
    displayName: "ACF",
    minimumOvertimeQuestionCount: 1,
    overtimeIncludesBonuses: false,
    negValue: -5,
    powers: [],
    regulationTossupCount: 20,
    timeoutsAllowed: 1,
    pronunciationGuideMarkers: ['("', '")'],
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
    pronunciationGuideMarkers: ['("', '")'],
    pairTossupsBonuses: false,
    version: currentVersion,
};

export const StandardPowersMACFGameFormat: IGameFormat = {
    ...createMACFGameFormat([{ marker: "(*)", points: 15 }]),
    displayName: "mACF with powers",
};

// The most competitors an individual game can have. IPNCT rooms hold three or more players (typically eight to
// ten), and this is the ceiling MODAQ supports.
export const maximumIndividualPlayerCount = 16;

// The most sides a TEAM game can have. Two is the format nearly everyone plays,
// but the scoring engine has never actually required it, so a reader running a
// three-way or a round robin in one room is not held back by the app.
export const maximumTeamCount = 16;

// NAQT's Individual Player National Championship Tournament: players compete on their own, games are tossups
// only, and every incorrect buzz before the end of the question is a neg (not just the first one).
export const IPNCTGameFormat: IGameFormat = {
    bonusesBounceBack: false,
    displayName: "IPNCT (individual)",
    minimumOvertimeQuestionCount: 1,
    overtimeIncludesBonuses: false,
    negValue: -5,
    powers: [{ marker: "(*)", points: 15 }],
    regulationTossupCount: 20,
    timeoutsAllowed: 0,
    pronunciationGuideMarkers: ['("', '")'],
    pairTossupsBonuses: false,
    isIndividualFormat: true,
    maximumPlayerCount: maximumIndividualPlayerCount,
    negsForEveryWrongBuzz: true,
    tossupsOnly: true,
    version: currentVersion,
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
    pronunciationGuideMarkers: ['("', '")'],
    pairTossupsBonuses: false,
    version: currentVersion,
};

// The freeform format has to stay last, since the format picker falls back to the last option when the current
// format doesn't match a known one
export function getKnownFormats(): IGameFormat[] {
    return [ACFGameFormat, StandardPowersMACFGameFormat, PACEGameFormat, IPNCTGameFormat, UndefinedGameFormat];
}

// Whether players compete on their own instead of on teams. Individual games treat each player as a
// one-player team, so they can have more than two competitors.
export function isIndividualFormat(format: IGameFormat): boolean {
    return format.isIndividualFormat === true;
}

// The most competitors (teams, or players in an individual format) a game in this format can have
export function getMaximumTeamCount(format: IGameFormat): number {
    if (isIndividualFormat(format)) {
        // Clamp to what the rest of the app can handle, in case a hand-edited format asks for more
        return Math.max(
            2,
            Math.min(maximumIndividualPlayerCount, format.maximumPlayerCount ?? maximumIndividualPlayerCount)
        );
    }

    // Team games are nearly always two sides, but nothing in the scoring
    // requires it: a score is an array indexed by team, and the QBJ export
    // builds one match_team per team. A format may pin itself to two; without
    // one, a reader may add sides up to the same ceiling individual games use.
    return Math.max(2, Math.min(maximumTeamCount, format.maximumTeamCount ?? maximumTeamCount));
}

// Whether every incorrect buzz before the end of a tossup is a neg, rather than just the first one
export function negsForEveryWrongBuzz(format: IGameFormat): boolean {
    return format.negsForEveryWrongBuzz === true;
}

// Whether tossups are followed by bonuses. Individual formats like IPNCT are tossups only.
export function hasBonuses(format: IGameFormat): boolean {
    return format.tossupsOnly !== true;
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
