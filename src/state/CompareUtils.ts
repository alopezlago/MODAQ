import { IPlayer, ITeam } from "./TeamState";

export function playersEqual(player: IPlayer, other: IPlayer): boolean {
    return teamsEqual(player, other) && player.name === other.name;
}

export function teamsEqual(team: ITeam, other: ITeam): boolean {
    return team.name === other.name;
}
