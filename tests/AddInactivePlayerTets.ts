import { assert, expect } from "chai";
import { AppState } from "src/state/AppState";
import { Cycle } from "src/state/Cycle";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";

const defaultPacket: PacketState = new PacketState();
defaultPacket.setTossups([
    new Tossup("first q", "first a"),
    new Tossup("second q", "second a"),
    new Tossup("thrid q", "third a"),
    new Tossup("fourth q", "fourth a"),
    new Tossup("fifth q", "fifth a"),
]);

const defaultTeamNames: string[] = ["Alpha", "Beta"];

const defaultExistingPlayers: Player[] = [
    new Player("Alice", defaultTeamNames[0], true),
    new Player("Arthur", defaultTeamNames[0], false),
    new Player("Bob", defaultTeamNames[1], true),
    new Player("Betty", defaultTeamNames[1], false),
];

const defaultInactivePlayer: Player = new Player("Anna", defaultTeamNames[0], false);

function initializeApp(): AppState {
    const gameState: GameState = new GameState();
    gameState.loadPacket(defaultPacket);

    gameState.addNewPlayers(defaultExistingPlayers);

    AppState.resetInstance();
    const appState: AppState = AppState.instance;
    appState.game = gameState;
    appState.game.addNewPlayer(defaultInactivePlayer);
    return appState;
}

function assertPlayerJoin(cycle: Cycle, player: Player): void {
    const joinEvents = cycle.playerJoins;
    if (joinEvents == undefined) {
        assert.fail("No join events found for this cycle");
    }

    expect(joinEvents[0].inPlayer).to.equal(player);
}

describe("AddInactivePlayerTests", () => {
    it("addInactivePlayer in first cycle", () => {
        const appState: AppState = initializeApp();
        appState.game.addInactivePlayer(defaultInactivePlayer, 0);
        const firstPlayers: Set<Player> = appState.game.getActivePlayers(defaultInactivePlayer.teamName, 0);
        expect(firstPlayers.has(defaultInactivePlayer)).to.be.true;

        const lastPlayers: Set<Player> = appState.game.getActivePlayers(
            defaultInactivePlayer.teamName,
            appState.game.cycles.length - 1
        );
        expect(lastPlayers.has(defaultInactivePlayer)).to.be.true;
    });
    it("addInactivePlayer in second cycle", () => {
        const appState: AppState = initializeApp();
        appState.game.addInactivePlayer(defaultInactivePlayer, 1);
        const beforePlayers: Set<Player> = appState.game.getActivePlayers(defaultInactivePlayer.teamName, 0);
        expect(beforePlayers.has(defaultInactivePlayer)).to.be.false;

        const players: Set<Player> = appState.game.getActivePlayers(defaultInactivePlayer.teamName, 1);
        expect(players.has(defaultInactivePlayer)).to.be.true;
    });
    it("addInactivePlayer after they've joined before does nothing", () => {
        const appState: AppState = initializeApp();
        appState.game.cycles[0].addPlayerJoins(defaultInactivePlayer);
        appState.game.addInactivePlayer(defaultInactivePlayer, 1);
        expect(appState.game.cycles[1].playerJoins).to.be.undefined;
        assertPlayerJoin(appState.game.cycles[0], defaultInactivePlayer);
    });
    it("addInactivePlayer before they've joined replaces joined event", () => {
        const appState: AppState = initializeApp();
        appState.game.cycles[2].addPlayerJoins(defaultInactivePlayer);
        appState.game.addInactivePlayer(defaultInactivePlayer, 1);
        expect(appState.game.cycles[2].playerJoins).to.be.empty;
        expect(appState.game.cycles[2].playerLeaves).to.be.undefined;
        expect(appState.game.cycles[2].subs).to.be.undefined;

        assertPlayerJoin(appState.game.cycles[1], defaultInactivePlayer);
    });
    it("addInactivePlayer after they've joined and left adds them back", () => {
        const appState: AppState = initializeApp();
        appState.game.cycles[0].addPlayerJoins(defaultInactivePlayer);
        appState.game.cycles[1].addPlayerLeaves(defaultInactivePlayer);
        appState.game.addInactivePlayer(defaultInactivePlayer, 2);

        assertPlayerJoin(appState.game.cycles[0], defaultInactivePlayer);
        assertPlayerJoin(appState.game.cycles[2], defaultInactivePlayer);

        const firstCyclePlayers: Set<Player> = appState.game.getActivePlayers(defaultInactivePlayer.teamName, 0);
        expect(firstCyclePlayers.has(defaultInactivePlayer)).to.be.true;
        const secondCyclePlayers: Set<Player> = appState.game.getActivePlayers(defaultInactivePlayer.teamName, 1);
        expect(secondCyclePlayers.has(defaultInactivePlayer)).to.be.false;
        const thirdCyclePlayers: Set<Player> = appState.game.getActivePlayers(defaultInactivePlayer.teamName, 2);
        expect(thirdCyclePlayers.has(defaultInactivePlayer)).to.be.true;
    });
    it("addInactivePlayer, leave after and then join after still adds the player", () => {
        const appState: AppState = initializeApp();
        const playerToLeave: Player = defaultExistingPlayers[0];

        appState.game.cycles[3].addPlayerJoins(playerToLeave);
        appState.game.cycles[2].addPlayerLeaves(playerToLeave);
        appState.game.addInactivePlayer(playerToLeave, 1);

        assertPlayerJoin(appState.game.cycles[1], playerToLeave);
        assertPlayerJoin(appState.game.cycles[3], playerToLeave);

        const thirdCycleLeaveEvents = appState.game.cycles[2].playerLeaves;
        if (thirdCycleLeaveEvents == undefined) {
            assert.fail("No leave events found for the third cycle");
        }

        expect(thirdCycleLeaveEvents[0].outPlayer).to.equal(playerToLeave);
    });
    it("addInactivePlayer after leave adds the player", () => {
        const appState: AppState = initializeApp();
        const playerToLeave: Player = defaultExistingPlayers[0];
        appState.game.cycles[1].addPlayerLeaves(playerToLeave);
        appState.game.addInactivePlayer(playerToLeave, 2);

        assertPlayerJoin(appState.game.cycles[2], playerToLeave);

        const secondCycleLeaveEvents = appState.game.cycles[1].playerLeaves;
        if (secondCycleLeaveEvents == undefined) {
            assert.fail("No leave events found for the second cycle");
        }

        expect(secondCycleLeaveEvents[0].outPlayer).to.equal(playerToLeave);
    });
    it("addInactivePlayer but player was already subbed in", () => {
        const appState: AppState = initializeApp();
        appState.game.cycles[1].addSwapSubstitution(defaultInactivePlayer, defaultExistingPlayers[0]);
        appState.game.addInactivePlayer(defaultInactivePlayer, 3);

        expect(appState.game.cycles[3].playerJoins).to.be.undefined;

        const secondCycleSubEvents = appState.game.cycles[1].subs;
        if (secondCycleSubEvents == undefined) {
            assert.fail("No sub events found for the second cycle");
        }

        expect(secondCycleSubEvents[0].inPlayer).to.equal(defaultInactivePlayer);
    });
    it("addInactivePlayer but player is subbed in later", () => {
        const appState: AppState = initializeApp();
        appState.game.cycles[3].addSwapSubstitution(defaultInactivePlayer, defaultExistingPlayers[0]);
        appState.game.addInactivePlayer(defaultInactivePlayer, 1);

        assertPlayerJoin(appState.game.cycles[1], defaultInactivePlayer);

        const fourthCycleSubEvents = appState.game.cycles[3].subs;
        if (fourthCycleSubEvents == undefined) {
            assert.fail("No sub events found for the fourth cycle");
        }

        expect(fourthCycleSubEvents.length).to.equal(1);
    });
    it("addInactivePlayer, player subbed in but then left", () => {
        const appState: AppState = initializeApp();
        const player: Player = defaultExistingPlayers[0];
        appState.game.cycles[1].addSwapSubstitution(defaultInactivePlayer, player);
        appState.game.addInactivePlayer(player, 3);

        assertPlayerJoin(appState.game.cycles[3], player);

        const secondCycleSubEvents = appState.game.cycles[1].subs;
        if (secondCycleSubEvents == undefined) {
            assert.fail("No sub events found for the second cycle");
        }

        expect(secondCycleSubEvents[0].inPlayer).to.equal(defaultInactivePlayer);
        expect(secondCycleSubEvents[0].outPlayer).to.equal(player);
    });
    it("addInactivePlayer subbed in after they leave", () => {
        const appState: AppState = initializeApp();
        appState.game.cycles[3].addSwapSubstitution(defaultInactivePlayer, defaultExistingPlayers[0]);
        appState.game.cycles[2].addPlayerLeaves(defaultInactivePlayer);
        appState.game.addInactivePlayer(defaultInactivePlayer, 1);

        assertPlayerJoin(appState.game.cycles[1], defaultInactivePlayer);

        const secondCycleSubEvents = appState.game.cycles[3].subs;
        if (secondCycleSubEvents == undefined) {
            assert.fail("No sub events found for the second cycle");
        }

        expect(secondCycleSubEvents[0].inPlayer).to.equal(defaultInactivePlayer);
    });
    it("addInactivePlayer after they were subbed out", () => {
        const appState: AppState = initializeApp();
        appState.game.cycles[3].addSwapSubstitution(defaultInactivePlayer, defaultExistingPlayers[0]);
        appState.game.cycles[2].addPlayerLeaves(defaultInactivePlayer);
        appState.game.addInactivePlayer(defaultInactivePlayer, 1);

        assertPlayerJoin(appState.game.cycles[1], defaultInactivePlayer);

        const secondCycleSubEvents = appState.game.cycles[3].subs;
        if (secondCycleSubEvents == undefined) {
            assert.fail("No sub events found for the second cycle");
        }

        expect(secondCycleSubEvents[0].inPlayer).to.equal(defaultInactivePlayer);
    });

    it("addInactivePlayer in second cycle with different team", () => {
        const appState: AppState = initializeApp();

        const newPlayer: Player = new Player("Bill", defaultTeamNames[1], false);
        appState.game.addNewPlayer(newPlayer);
        appState.game.addInactivePlayer(newPlayer, 1);
        const beforePlayers: Set<Player> = appState.game.getActivePlayers(newPlayer.teamName, 0);
        expect(beforePlayers.has(newPlayer)).to.be.false;

        const players: Set<Player> = appState.game.getActivePlayers(newPlayer.teamName, 1);
        expect(players.has(newPlayer)).to.be.true;
    });
    it("addInactivePlayer with same name from different team", () => {
        const appState: AppState = initializeApp();

        const newPlayer: Player = new Player(defaultInactivePlayer.name, defaultTeamNames[1], false);
        appState.game.addNewPlayer(newPlayer);
        appState.game.addInactivePlayer(newPlayer, 0);
        const players: Set<Player> = appState.game.getActivePlayers(newPlayer.teamName, 0);
        expect(players.has(defaultInactivePlayer)).to.be.false;
        expect(players.has(newPlayer)).to.be.true;
    });
});
