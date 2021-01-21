import { IPendingNewGame, PendingGameType } from "./IPendingNewGame";
import { Player } from "./TeamState";

export function getPendingNewGamePlayers(pendingNewGame: IPendingNewGame): [Player[], Player[]] {
    if (pendingNewGame.type === PendingGameType.Manual) {
        return [pendingNewGame.firstTeamPlayers, pendingNewGame.secondTeamPlayers];
    } else {
        return [pendingNewGame.firstTeamPlayersFromRosters ?? [], pendingNewGame.secondTeamPlayersFromRosters ?? []];
    }
}
