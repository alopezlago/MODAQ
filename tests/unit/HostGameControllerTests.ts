import { expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import * as HostGameController from "src/components/HostGameController";
import * as QBJ from "src/qbj/QBJ";
import { AppState } from "src/state/AppState";
import { IPacket } from "src/state/IPacket";
import { Player } from "src/state/TeamState";

// Games a host starts itself, and a shootout's competitors coming and going. What matters in the second half is
// the record left behind: someone who arrives at question 6 heard questions 6 onward and nothing before, someone who
// leaves during question 3 heard question 3 (and keeps what they buzzed on it), and a blip — gone and back before
// the reader moves on — leaves no trace at all.

const LONG =
    "This is a long enough question text that the packet loader won't warn about it being too short for a (*) tossup.";

function packet(count: number): IPacket {
    return {
        tossups: Array.from({ length: count }, (_unused, i) => ({
            question: `${i + 1}. ${LONG}`,
            answer: `Answer ${i + 1}`,
        })),
    };
}

function started(teams: string[], count = 10): AppState {
    const appState = new AppState();
    HostGameController.startHostNewGame(appState, {
        packet: packet(count),
        packetName: "Packet 1",
        teams: teams.map((name) => ({ name, players: [name] })),
        gameFormat: { ...GameFormats.ACFGameFormat, tossupsOnly: true },
    });
    return appState;
}

function activeAt(appState: AppState, team: string, cycle: number): boolean {
    return Array.from(appState.game.getActivePlayers(team, cycle)).some((p) => p.name === team);
}

function heard(appState: AppState, cycleIndex: number, name: string): number {
    appState.uiState.setCycleIndex(cycleIndex);
    const match = QBJ.toQBJ(appState.game, "Packet 1");
    for (const team of match.match_teams) {
        for (const player of team.match_players) {
            if (player.player.name === name) {
                return player.tossups_heard;
            }
        }
    }
    throw new Error(`${name} isn't in the game`);
}

// Everyone in the room, as the host lists them: Ann and Bob are there unless a test says otherwise.
const live = (entries: [string, boolean][]): HostGameController.ILiveTeam[] => {
    const present: Map<string, boolean> = new Map<string, boolean>([
        ["Ann", true],
        ["Bob", true],
    ]);
    for (const [name, here] of entries) {
        present.set(name, here);
    }
    return Array.from(present.entries()).map(([name, here]) => ({ name, players: [name], present: here }));
};

describe("HostGameControllerTests", () => {
    describe("startHostNewGame", () => {
        it("loads the packet, the teams and the format, at the first question", () => {
            const appState = started(["Ann", "Bob"]);
            expect(appState.game.isLoaded).to.be.true;
            expect(appState.game.packet.tossups.length).to.equal(10);
            expect(appState.game.teamNames).to.deep.equal(["Ann", "Bob"]);
            expect(appState.game.gameFormat.tossupsOnly).to.be.true;
            expect(appState.uiState.cycleIndex).to.equal(0);
            expect(appState.uiState.packetFilename).to.equal("Packet 1");
        });
        it("replaces the game that was loaded", () => {
            const appState = started(["Ann", "Bob"]);
            appState.uiState.setCycleIndex(4);
            HostGameController.startHostNewGame(appState, {
                packet: packet(6),
                teams: [{ name: "Cal", players: ["Cal"] }],
            });
            expect(appState.game.teamNames).to.deep.equal(["Cal"]);
            expect(appState.game.packet.tossups.length).to.equal(6);
            expect(appState.uiState.cycleIndex).to.equal(0);
        });
        it("a team with nobody named plays under its own name, and duplicates are dropped", () => {
            const appState = new AppState();
            HostGameController.startHostNewGame(appState, {
                packet: packet(3),
                teams: [
                    { name: "Ann", players: [] },
                    { name: "Ann", players: ["Someone else"] },
                    { name: " ", players: ["Nobody"] },
                ],
            });
            expect(appState.game.players.map((p) => `${p.teamName}/${p.name}`)).to.deep.equal(["Ann/Ann"]);
        });
        it("a packet that won't load leaves the game alone", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.startHostNewGame(appState, {
                packet: { tossups: [] },
                teams: [{ name: "Cal", players: [] }],
            });
            expect(appState.game.teamNames).to.deep.equal(["Ann", "Bob"]);
        });
    });

    describe("syncLiveTeams: arriving", () => {
        it("someone who arrives before the first question is a starter", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(
                appState,
                live([
                    ["Ann", true],
                    ["Bob", true],
                    ["Cal", true],
                ]),
                0
            );
            const cal: Player | undefined = appState.game.players.find((p) => p.name === "Cal");
            expect(cal?.isStarter).to.be.true;
            expect(appState.game.cycles.every((c) => (c.playerJoins ?? []).length === 0)).to.be.true;
            expect(heard(appState, 9, "Cal")).to.equal(10);
        });
        it("someone who arrives at question 6 heard questions 6 onward", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(appState, live([["Cal", true]]), 5);
            expect(activeAt(appState, "Cal", 4)).to.be.false;
            expect(activeAt(appState, "Cal", 5)).to.be.true;
            expect(heard(appState, 9, "Cal")).to.equal(5);
            expect(heard(appState, 9, "Ann")).to.equal(10);
        });
        it("someone who isn't here isn't added", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(appState, live([["Cal", false]]), 2);
            expect(appState.game.teamNames).to.deep.equal(["Ann", "Bob"]);
        });
        it("nothing happens without a game", () => {
            const appState = new AppState();
            HostGameController.syncLiveTeams(appState, live([["Cal", true]]), 0);
            expect(appState.game.players.length).to.equal(0);
        });
    });

    describe("syncLiveTeams: leaving and coming back", () => {
        it("someone who leaves during question 3 heard it, and not the ones after", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(
                appState,
                live([
                    ["Ann", true],
                    ["Bob", false],
                ]),
                2
            );
            expect(activeAt(appState, "Bob", 2)).to.be.true;
            expect(activeAt(appState, "Bob", 3)).to.be.false;
            expect(heard(appState, 9, "Bob")).to.equal(3);
        });
        it("...and keeps what they buzzed on it", () => {
            const appState = started(["Ann", "Bob"]);
            const bob = appState.game.players.find((p) => p.name === "Bob") as Player;
            appState.game.cycles[2].addCorrectBuzz(
                { player: bob, points: 10, position: 3, isLastWord: false },
                2,
                appState.game.gameFormat,
                undefined,
                undefined
            );
            HostGameController.syncLiveTeams(
                appState,
                live([
                    ["Ann", true],
                    ["Bob", false],
                ]),
                2
            );
            expect(appState.game.cycles[2].correctBuzz?.marker.player.name).to.equal("Bob");
        });
        it("gone and back before the reader moves on leaves no trace", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(appState, live([["Bob", false]]), 2);
            HostGameController.syncLiveTeams(appState, live([["Bob", true]]), 2);
            expect(appState.game.cycles.every((c) => (c.playerLeaves ?? []).length === 0)).to.be.true;
            expect(appState.game.cycles.every((c) => (c.playerJoins ?? []).length === 0)).to.be.true;
            expect(heard(appState, 9, "Bob")).to.equal(10);
        });
        it("back while the next question is being read: they heard it after all", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(appState, live([["Bob", false]]), 2);
            // The reader has moved on to question 4 while Bob was away.
            HostGameController.syncLiveTeams(appState, live([["Bob", true]]), 3);
            expect(activeAt(appState, "Bob", 3)).to.be.true;
            expect(heard(appState, 9, "Bob")).to.equal(10);
        });
        it("back two questions later: missed those two", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(appState, live([["Bob", false]]), 2);
            HostGameController.syncLiveTeams(appState, live([["Bob", false]]), 4);
            HostGameController.syncLiveTeams(appState, live([["Bob", true]]), 5);
            expect(activeAt(appState, "Bob", 3)).to.be.false;
            expect(activeAt(appState, "Bob", 4)).to.be.false;
            expect(activeAt(appState, "Bob", 5)).to.be.true;
            expect(heard(appState, 9, "Bob")).to.equal(8);
        });
        it("in and out several times, and the count adds up", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(appState, live([["Bob", false]]), 1); // heard 1-2
            HostGameController.syncLiveTeams(appState, live([["Bob", true]]), 4); // back for 5
            HostGameController.syncLiveTeams(appState, live([["Bob", false]]), 6); // heard 5-7
            HostGameController.syncLiveTeams(appState, live([["Bob", true]]), 8); // back for 9-10
            expect(heard(appState, 9, "Bob")).to.equal(2 + 3 + 2);
        });
        it("someone who has left the room altogether (not on the list at all) is gone too", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(appState, [{ name: "Ann", players: ["Ann"], present: true }], 2);
            expect(activeAt(appState, "Bob", 3)).to.be.false;
            expect(heard(appState, 9, "Bob")).to.equal(3);
            expect(appState.game.teamNames).to.deep.equal(["Ann", "Bob"]);
        });
        it("saying the same thing twice records it once", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(
                appState,
                live([
                    ["Bob", false],
                    ["Cal", true],
                ]),
                3
            );
            HostGameController.syncLiveTeams(
                appState,
                live([
                    ["Bob", false],
                    ["Cal", true],
                ]),
                3
            );
            const leaves = appState.game.cycles.reduce((n, c) => n + (c.playerLeaves ?? []).length, 0);
            const joins = appState.game.cycles.reduce((n, c) => n + (c.playerJoins ?? []).length, 0);
            expect(leaves).to.equal(1);
            expect(joins).to.equal(1);
            expect(appState.game.teamNames).to.deep.equal(["Ann", "Bob", "Cal"]);
        });
        it("leaving during the last question changes nothing: they heard the whole packet", () => {
            const appState = started(["Ann", "Bob"]);
            HostGameController.syncLiveTeams(appState, live([["Bob", false]]), 9);
            expect(heard(appState, 9, "Bob")).to.equal(10);
        });
        it("the question reached is never earlier than the last one anyone buzzed on", () => {
            const appState = started(["Ann", "Bob"]);
            const ann = appState.game.players.find((p) => p.name === "Ann") as Player;
            appState.game.cycles[6].addCorrectBuzz(
                { player: ann, points: 10, position: 3, isLastWord: false },
                6,
                appState.game.gameFormat,
                undefined,
                undefined
            );
            // A screen that has just loaded the game and thinks the reader is at the start.
            HostGameController.syncLiveTeams(appState, live([["Cal", true]]), 0);
            expect(activeAt(appState, "Cal", 5)).to.be.false;
            expect(activeAt(appState, "Cal", 6)).to.be.true;
        });
    });
});
