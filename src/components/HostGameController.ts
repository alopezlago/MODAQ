// Games a host starts and keeps up to date itself, rather than through MODAQ's New Game dialog: starting one
// straight from a packet and a list of teams, and — for a game whose competitors come and go, like a shootout —
// adding whoever arrives and recording who has left, so each player is credited with the tossups they heard.
// Used by ModaqControl's hostNewGame and liveTeams props.

import { runInAction } from "mobx";

import * as PacketLoaderController from "./PacketLoaderController";
import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";
import { IGameFormat } from "../state/IGameFormat";
import { IPacket } from "../state/IPacket";
import { PacketState } from "../state/PacketState";
import { IPlayer, Player } from "../state/TeamState";

export interface IHostTeam {
    name: string;
    players: string[];
}

export interface ILiveTeam extends IHostTeam {
    present: boolean;
}

export interface IHostNewGame {
    packet: IPacket;
    packetName?: string;
    teams: IHostTeam[];
    /** The game's format. Defaults to the control's `gameFormat`, then to MODAQ's own default. */
    gameFormat?: IGameFormat;
    /** Open the New Game dialog prefilled, rather than starting the game. */
    confirm?: boolean;
}

// A player row for each name, on its team; a team with nobody named still gets
// its name onto the game through one player named for the team (a shootout
// competitor IS their team, so that's the usual case, not a fallback).
export function hostTeamPlayers(team: IHostTeam, isStarter = true): Player[] {
    const names = team.players.map((name) => name.trim()).filter((name) => name !== "");
    return (names.length > 0 ? names : [team.name]).map((name) => new Player(name, team.name, isStarter));
}

// Start the host's game at once — what the New Game dialog's Start does, without the dialog.
export function startHostNewGame(appState: AppState, spec: IHostNewGame): void {
    const packetState: PacketState | undefined = PacketLoaderController.loadPacket(
        appState,
        spec.packet,
        spec.packetName
    );
    if (packetState == undefined || packetState.tossups.length === 0) {
        // Nothing to read (loadPacket has said what was wrong, if it could tell); the game on screen stays.
        return;
    }

    const seen: Set<string> = new Set<string>();
    const teams: IHostTeam[] = spec.teams.filter((team) => {
        const name = team.name.trim();
        if (name === "" || seen.has(name)) {
            return false;
        }
        seen.add(name);
        return true;
    });

    runInAction(() => {
        const uiState = appState.uiState;
        const game = appState.game;
        uiState.dialogState.hideModalDialog();
        uiState.resetPendingNewGame();

        game.clear();
        // Errata belong to the packet that was just played.
        appState.errata.clear();
        for (const team of teams) {
            game.addNewPlayers(hostTeamPlayers(team));
        }
        game.loadPacket(packetState);
        if (spec.gameFormat != undefined) {
            game.setGameFormat(spec.gameFormat);
        }
        uiState.setCycleIndex(0);
        uiState.resetSheetsId();
        if (spec.packetName != undefined) {
            uiState.setPacketFilename(spec.packetName);
            packetState.setName(spec.packetName);
        }
    });
}

// The last question anyone buzzed on — the reader has certainly reached it, even
// on a screen that has only just loaded the game.
export function lastPlayedCycle(appState: AppState): number {
    const cycles = appState.game.cycles;
    for (let i = cycles.length - 1; i >= 0; i--) {
        const cycle = cycles[i];
        if (cycle.correctBuzz != undefined || (cycle.wrongBuzzes?.length ?? 0) > 0) {
            return i;
        }
    }
    return 0;
}

export function syncLiveTeams(appState: AppState, teams: ILiveTeam[], furthest: number): void {
    const game = appState.game;
    if (!game.isLoaded || game.cycles.length === 0) {
        return;
    }
    const at: number = Math.min(Math.max(furthest, lastPlayedCycle(appState)), game.cycles.length - 1);
    runInAction(() => {
        let changed = false;
        const have: Set<string> = new Set<string>(game.teamNames);
        for (const team of teams) {
            const name = team.name.trim();
            if (name === "") {
                continue;
            }
            if (!have.has(name)) {
                if (!team.present) {
                    continue;
                }
                // Someone new: in the game from the question the reader has reached. Before the first question
                // they're simply a starter; after it, they join, like a player MODAQ's own Add Player brings in.
                const players = hostTeamPlayers(team, /* isStarter */ at === 0);
                game.addNewPlayers(players);
                if (at > 0) {
                    for (const player of players) {
                        game.cycles[at].addPlayerJoins(player, /* isInactive */ false);
                    }
                }
                have.add(name);
                changed = true;
                continue;
            }
            for (const player of game.getPlayers(name)) {
                changed = syncPresence(appState, player, team.present, at) || changed;
            }
        }
        // The list is everyone the host knows about: a team in the game that isn't on it has gone (someone who
        // left the room outright isn't in the room to be listed).
        const listed: Set<string> = new Set<string>(teams.map((team) => team.name.trim()));
        for (const name of game.teamNames) {
            if (!listed.has(name)) {
                for (const player of game.getPlayers(name)) {
                    changed = syncPresence(appState, player, /* present */ false, at) || changed;
                }
            }
        }
        if (changed) {
            game.markUpdateNeeded();
        }
    });
}

// Make a player active (or not) from question `at` on, recording it the way a
// moderator would: a departure takes effect from the NEXT question — a player
// leaving is credited with the one being read, and a leave at the current
// question would also throw away anything they buzzed on it — and an arrival
// from this one.
export function syncPresence(appState: AppState, player: Player, present: boolean, at: number): boolean {
    const game = appState.game;
    let active: boolean;
    try {
        active = Array.from(game.getActivePlayers(player.teamName, at)).some((p) => p.name === player.name);
    } catch {
        // The game's substitutions don't add up (edited by hand?); leave them alone.
        return false;
    }
    const same = (other: IPlayer): boolean => other.name === player.name && other.teamName === player.teamName;
    const current: Cycle = game.cycles[at];
    const next: Cycle | undefined = at + 1 < game.cycles.length ? game.cycles[at + 1] : undefined;
    const pendingLeave = next?.playerLeaves?.find((event) => same(event.outPlayer));

    if (present) {
        if (next != undefined && pendingLeave != undefined) {
            // Back before the reader moved on: they never really left.
            next.removePlayerLeaves(pendingLeave);
            return true;
        }
        if (!active) {
            const leftHere = current.playerLeaves?.find((event) => same(event.outPlayer));
            if (leftHere != undefined) {
                current.removePlayerLeaves(leftHere);
            } else {
                current.addPlayerJoins(player, /* isInactive */ false);
            }
            return true;
        }
        return false;
    }

    if (active && next != undefined && pendingLeave == undefined) {
        next.addPlayerLeaves(player);
        return true;
    }
    return false;
}
