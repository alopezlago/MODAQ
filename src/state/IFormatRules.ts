// - Optional dropdown, containing the format rules, which includes
//   - If timeouts are allowed
//   - If subs are allowed
//   - Point values for powers?
//   - Number of tossups in regulation
//     - This should drive the number of cycles we show? We could still create the cycles.
//   - Tiebreaking procedures
//   - Eventually this should use QBSchema's interface for this, we'd want to use something like this to convert the
//     GraphQL to a TypeScript definition: https://dev.to/open-graphql/how-to-resolve-import-for-the-graphql-file-with-typescript-and-webpack-35lf

export interface IFormatRules {
    activePlayersPerTeam: number;
    questionsInRegulation: number;
    timeoutsPerTeam: number;
    tossupsInFirstOvertime: number;
    tossupsInOtherOvertimes: number;
}

// TODO: Double check these
export const AcfFormatRules: IFormatRules = {
    activePlayersPerTeam: 4,
    timeoutsPerTeam: 1,
    questionsInRegulation: 20,
    tossupsInFirstOvertime: 3,
    tossupsInOtherOvertimes: 1,
};
