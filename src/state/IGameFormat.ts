// This should closely mirror ScoringRules here https://github.com/quizbowl/schema/blob/master/schema/tournament.graphql,
// since it covers much of the same ground
// We may need to add additional rules, though, such as if powers are supported
// TODO: We should have an enum for when substitutions are allowed

export interface IGameFormat {
    regulationTossupCount: number;
    minimumOvertimeQuestionCount: number;
    overtimeIncludesBonuses: boolean;
    bonusesBounceBack: boolean;
    negValue: number;

    // Empty array means that powers aren't supported
    // This array must be in descending order
    pointsForPowers: number[];
    powerMarkers: string[];

    timeoutsAllowed: number;
    displayName: string;

    // Tells us which version this format was generated from, so we can support backwards compatibility if possible
    version: string;
}
