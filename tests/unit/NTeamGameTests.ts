import { expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import * as PendingNewGameUtils from "src/state/PendingNewGameUtils";
import * as QBJ from "src/qbj/QBJ";
import { AppState } from "src/state/AppState";
import { Cycle } from "src/state/Cycle";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup } from "src/state/PacketState";
import { PendingGameType } from "src/state/IPendingNewGame";
import { Player } from "src/state/TeamState";
import { UIState } from "src/state/UIState";

// A team game with more than two sides. The scoring engine and the QBJ export
// were always written against an arbitrary number of teams -- a score is an
// array indexed by team -- so what these cover is the parts that used to say
// "two" out loud: the format's ceiling, the New Game rosters, and the import.

function packetOf(count: number): PacketState {
    const packet = new PacketState();
    packet.setTossups(
        Array.from({ length: count }, (_unused, i) => new Tossup(`Question ${i + 1} with a (*) power.`, `Answer ${i + 1}`))
    );
    return packet;
}

function gameOf(teamNames: string[]): GameState {
    const game = new GameState();
    game.setGameFormat({ ...GameFormats.ACFGameFormat, maximumTeamCount: undefined });
    game.addNewPlayers(teamNames.map((name) => new Player(`${name} player`, name, /* isStarter */ true)));
    game.loadPacket(packetOf(teamNames.length + 4));
    game.setCycles(teamNames.map(() => new Cycle()));
    return game;
}

describe("NTeamGameTests", () => {
    describe("format ceiling", () => {
        it("a team format allows more than two sides", () => {
            expect(GameFormats.getMaximumTeamCount(GameFormats.ACFGameFormat)).to.be.greaterThan(2);
        });
        it("...but a format may pin itself to two", () => {
            expect(GameFormats.getMaximumTeamCount({ ...GameFormats.ACFGameFormat, maximumTeamCount: 2 })).to.equal(2);
        });
        it("never fewer than two, however the format is edited", () => {
            expect(GameFormats.getMaximumTeamCount({ ...GameFormats.ACFGameFormat, maximumTeamCount: 1 })).to.equal(2);
        });
        it("and never past what the app can hold", () => {
            expect(
                GameFormats.getMaximumTeamCount({ ...GameFormats.ACFGameFormat, maximumTeamCount: 500 })
            ).to.equal(GameFormats.maximumTeamCount);
        });
    });

    describe("entering the teams", () => {
        it("a new game starts with the two sides nearly every game has", () => {
            const uiState = new UIState();
            uiState.createPendingNewGame();
            if (uiState.pendingNewGame?.type !== PendingGameType.Manual) {
                throw new Error("expected a manual pending game");
            }
            expect(uiState.pendingNewGame.manual.teamPlayers.length).to.equal(2);
        });

        it("a third team can be added, and named after itself", () => {
            const uiState = new UIState();
            uiState.createPendingNewGame();
            uiState.addTeamToPendingNewGame();
            if (uiState.pendingNewGame?.type !== PendingGameType.Manual) {
                throw new Error("expected a manual pending game");
            }
            const teams = uiState.pendingNewGame.manual.teamPlayers;
            expect(teams.length).to.equal(3);
            expect(teams[2][0].teamName).to.equal("Team 3");
        });

        it("the last two teams cannot be removed", () => {
            const uiState = new UIState();
            uiState.createPendingNewGame();
            uiState.addTeamToPendingNewGame();
            uiState.removeTeamFromPendingNewGame(2);
            uiState.removeTeamFromPendingNewGame(1);
            if (uiState.pendingNewGame?.type !== PendingGameType.Manual) {
                throw new Error("expected a manual pending game");
            }
            expect(uiState.pendingNewGame.manual.teamPlayers.length).to.equal(2);
        });

        it("teams stop being added at the format's ceiling", () => {
            const uiState = new UIState();
            uiState.createPendingNewGame();
            uiState.setPendingNewGameFormat({ ...GameFormats.ACFGameFormat, maximumTeamCount: 3 });
            uiState.addTeamToPendingNewGame();
            uiState.addTeamToPendingNewGame();
            uiState.addTeamToPendingNewGame();
            if (uiState.pendingNewGame?.type !== PendingGameType.Manual) {
                throw new Error("expected a manual pending game");
            }
            expect(uiState.pendingNewGame.manual.teamPlayers.length).to.equal(3);
        });

        it("a host can seed as many rosters as it likes", () => {
            const uiState = new UIState();
            uiState.createPendingNewGame();
            uiState.setPendingNewGameManualTeams(
                [new Player("a", "Alpha", true)],
                [new Player("b", "Beta", true)],
                [new Player("c", "Gamma", true)],
                [new Player("d", "Delta", true)]
            );
            if (uiState.pendingNewGame?.type !== PendingGameType.Manual) {
                throw new Error("expected a manual pending game");
            }
            const teams = uiState.pendingNewGame.manual.teamPlayers;
            expect(teams.length).to.equal(4);
            expect(teams.map((t) => t[0].teamName)).to.deep.equal(["Alpha", "Beta", "Gamma", "Delta"]);
        });

        it("and the players that reach the game are every roster", () => {
            const uiState = new UIState();
            uiState.createPendingNewGame();
            uiState.setPendingNewGameManualTeams(
                [new Player("a", "Alpha", true)],
                [new Player("b", "Beta", true)],
                [new Player("c", "Gamma", true)]
            );
            if (uiState.pendingNewGame == undefined) {
                throw new Error("expected a pending game");
            }
            const players: Player[][] = PendingNewGameUtils.getPendingNewGamePlayers(uiState.pendingNewGame);
            expect(players.length).to.equal(3);
            expect(players.map((team) => team[0].teamName)).to.deep.equal(["Alpha", "Beta", "Gamma"]);
        });
    });

    describe("scoring and export", () => {
        it("four teams score independently", () => {
            const game = gameOf(["Alpha", "Beta", "Gamma", "Delta"]);
            expect(game.teamNames.length).to.equal(4);
            const scores: number[] = game.scores[0];
            expect(scores.length).to.equal(4, "a score per team");
            expect(scores.every((s) => s === 0)).to.be.true;
        });

        it("and export as four match_teams", () => {
            const game = gameOf(["Alpha", "Beta", "Gamma", "Delta"]);
            const qbj: QBJ.IMatch = QBJ.toQBJ(game, "packet", 1);
            expect(qbj.match_teams.length).to.equal(4);
            expect(qbj.match_teams.map((t) => t.team.name)).to.deep.equal(["Alpha", "Beta", "Gamma", "Delta"]);
        });

        it("a three-way game survives the round trip through QBJ", () => {
            const game = gameOf(["Alpha", "Beta", "Gamma"]);
            const qbj: QBJ.IMatch = QBJ.toQBJ(game, "packet", 1);
            const result = QBJ.fromQBJ(qbj, game.packet, { ...GameFormats.ACFGameFormat, maximumTeamCount: undefined });
            expect(result.success).to.be.true;
            if (result.success) {
                expect(result.value.teamNames).to.deep.equal(["Alpha", "Beta", "Gamma"]);
            }
        });
    });

    describe("what still wants exactly two", () => {
        it("an app can be created and a three-team game set on it", () => {
            const appState = new AppState();
            appState.game = gameOf(["Alpha", "Beta", "Gamma"]);
            expect(appState.game.teamNames.length).to.equal(3);
            // protestsMatter has no two-team swing maths to fall back on here; with more than two teams it
            // reports on any open protest rather than trying to work out who a swing would help.
            expect(appState.game.protestsMatter).to.be.false;
        });
    });
});
