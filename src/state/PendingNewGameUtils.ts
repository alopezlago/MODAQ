import { assertNever } from "@fluentui/react";
import { IPendingNewGame, PendingGameType } from "./IPendingNewGame";
import { Player } from "./TeamState";

export function getPendingNewGamePlayers(pendingNewGame: IPendingNewGame): [Player[], Player[]] {
    switch (pendingNewGame.type) {
        case PendingGameType.Manual:
            return [pendingNewGame.manual.firstTeamPlayers, pendingNewGame.manual.secondTeamPlayers];
        case PendingGameType.QBJRegistration:
            return [
                pendingNewGame.registration.firstTeamPlayers ?? [],
                pendingNewGame.registration.secondTeamPlayers ?? [],
            ];
        case PendingGameType.TJSheets:
            return [
                pendingNewGame.tjSheets.firstTeamPlayersFromRosters ?? [],
                pendingNewGame.tjSheets.secondTeamPlayersFromRosters ?? [],
            ];
        case PendingGameType.UCSDSheets:
            return [
                pendingNewGame.ucsdSheets.firstTeamPlayersFromRosters ?? [],
                pendingNewGame.ucsdSheets.secondTeamPlayersFromRosters ?? [],
            ];
        default:
            assertNever(pendingNewGame);
    }
}
