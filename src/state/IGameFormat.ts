// This should closely mirror ScoringRules here https://github.com/quizbowl/schema/blob/master/schema/tournament.graphql,
// since it covers much of the same ground
// We may need to add additional rules, though, such as if powers are supported
// TODO: We should have an enum for when substitutions are allowed
// TODO: Consider adding a field for how many points gets are worth

export interface IGameFormat {
    regulationTossupCount: number;
    minimumOvertimeQuestionCount: number;
    overtimeIncludesBonuses: boolean;
    bonusesBounceBack: boolean;
    negValue: number;
    pairTossupsBonuses: boolean;

    // Both of these are deprecated
    pointsForPowers?: number[];
    powerMarkers?: string[];

    // Empty array means that powers aren't supported
    // This array must be in descending order
    powers: IPowerMarker[];

    timeoutsAllowed: number;
    displayName: string;

    // Available after 2026-08-19
    // Individual formats (e.g. NAQT's IPNCT) have players compete on their own instead of on teams. Each
    // competitor is treated as a one-player team, so a game can have more than the usual two competitors.
    // Undefined or false means the standard team game.
    isIndividualFormat?: boolean;

    // The most competitors a game can have. Only meaningful for individual formats; team games always have two.
    maximumPlayerCount?: number;

    // Standard formats only penalize the first incorrect buzz on a tossup. When this is true, every incorrect
    // buzz made before the end of the question is a neg (IPNCT).
    negsForEveryWrongBuzz?: boolean;

    // Tossup-only formats (IPNCT) have no bonuses, so the reader shouldn't be shown one.
    tossupsOnly?: boolean;

    // Available after 2021-07-11
    // An array representing the start and ending markers for a pronunciation guide, e.g. ["(", ")"] if guides look
    // like ("LIE-kuh")
    pronunciationGuideMarkers?: [string, string];

    // Tells us which version this format was generated from, so we can support backwards compatibility if possible
    version: string;
}

export interface IPowerMarker {
    marker: string;
    points: number;
}
