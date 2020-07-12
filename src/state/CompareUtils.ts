import { IPlayer } from "./TeamState";

export function playersEqual(player: IPlayer, other: IPlayer): boolean {
    return player.name === other.name && player.teamName === other.teamName;
}
