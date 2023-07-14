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
