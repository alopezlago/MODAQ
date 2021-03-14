import { IPlayer } from "src/state/TeamState";

export interface IPlayerToColumnMap {
    get(player: IPlayer): string | undefined;
    set(player: IPlayer, column: string): void;
}

// If we just used a Map<IPlayer, string>, we could run into issues where the serialized player from cycles don't
// match the serialized player in a game. This lets us convert the player's to a unique string without having all the
// places that rely on this map knowing the conversion
export function createPlayerToColumnMap(): IPlayerToColumnMap {
    const map: Map<string, string> = new Map<string, string>();
    return {
        get: (player: IPlayer) => map.get(getPlayerKey(player)),
        set: (player: IPlayer, column: string) => map.set(getPlayerKey(player), column),
    };
}

function getPlayerKey(player: IPlayer): string {
    return `${player.teamName.replace(/;/g, ";;")};${player.name}`;
}
