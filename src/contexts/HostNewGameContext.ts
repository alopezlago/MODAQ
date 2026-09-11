import * as React from "react";

/**
 * Lets a host take over the New Game command. When `onNewGameRequested` is set, choosing New game from the menu calls
 * it instead of opening MODAQ's New Game dialog — for a host that starts games its own way and hands MODAQ the
 * result (see `hostNewGame` on ModaqControl). Klaxon uses it so a reader outside a tournament goes from a packet file
 * straight to a game, and so a shootout, whose competitors are simply whoever is in the room, never asks for teams.
 */
export const HostNewGameContext: React.Context<IHostNewGameContextValue> = React.createContext<IHostNewGameContextValue>(
    {}
);

export interface IHostNewGameContextValue {
    onNewGameRequested?: () => void;
}
