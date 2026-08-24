import { assertNever } from "@fluentui/react";
import * as GameFormats from "./GameFormats";
import { IPendingNewGame, PendingGameType } from "./IPendingNewGame";
import { Player } from "./TeamState";

/**
 * The rosters the pending game would start with, one array per team. Team games have two; an individual format
 * like IPNCT has one one-player team per competitor.
 */
export function getPendingNewGamePlayers(pendingNewGame: IPendingNewGame): Player[][] {
    switch (pendingNewGame.type) {
        case PendingGameType.Manual:
            if (GameFormats.isIndividualFormat(pendingNewGame.gameFormat)) {
                return pendingNewGame.manual.individualPlayers.map((player) => [player]);
            }

            return [pendingNewGame.manual.firstTeamPlayers, pendingNewGame.manual.secondTeamPlayers];
        case PendingGameType.QBJRegistration:
            if (GameFormats.isIndividualFormat(pendingNewGame.gameFormat)) {
                return (pendingNewGame.registration.individualPlayers ?? []).map((player) => [player]);
            }

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
