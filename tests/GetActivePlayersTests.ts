import { expect } from "chai";
import { Cycle } from "src/state/Cycle";
import { Player } from "src/state/TeamState";
import { GameState } from "src/state/GameState";

describe("GameStateTests", () => {
    describe("getActivePlayers", () => {
        const firstTeamName = "A";
        const secondTeamName = "B";

        const firstTeamStarter: Player = new Player("Alice", firstTeamName, /* isStarter */ true);
        const anotherFirstTeamStarter: Player = new Player("Alan", firstTeamName, /* isStarter */ true);
        const firstTeamSub: Player = new Player("Anna", firstTeamName, /* isStarter*/ false);
        const secondTeamStarter: Player = new Player("Bob", secondTeamName, /* isStarter */ true);
        const anotherSecondTeamStarter: Player = new Player("Bianca", secondTeamName, /* isStarter */ true);
        const secondTeamSub: Player = new Player("Ben", secondTeamName, /* isStarter*/ false);

        const allStarters: Player[] = [
            firstTeamStarter,
            anotherFirstTeamStarter,
            secondTeamStarter,
            anotherSecondTeamStarter,
        ];
        const allPlayers = allStarters.concat(firstTeamSub, secondTeamSub);

        const firstTeamStarters: Player[] = allStarters.filter((player) => player.teamName === firstTeamName);
        const secondTeamStarters: Player[] = allStarters.filter((player) => player.teamName === secondTeamName);
        it("All starters no subs", () => {
            const game: GameState = new GameState();
            game.setCycles([new Cycle(), new Cycle()]);
            game.addPlayers(allStarters);

            allPlayersInSet(game.getActivePlayers(firstTeamName, 0), firstTeamStarters);
            allPlayersInSet(game.getActivePlayers(secondTeamName, 0), secondTeamStarters);

            const lastCycleIndex: number = game.cycles.length - 1;
            allPlayersInSet(game.getActivePlayers(firstTeamName, lastCycleIndex), firstTeamStarters);
            allPlayersInSet(game.getActivePlayers(secondTeamName, lastCycleIndex), secondTeamStarters);
        });
        it("Some non-starters no subs", () => {
            const game: GameState = new GameState();
            game.setCycles([new Cycle(), new Cycle()]);
            game.addPlayers(allPlayers);

            expect(game.getPlayers(firstTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === firstTeamName)
            );
            expect(game.getPlayers(secondTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === secondTeamName)
            );

            allPlayersInSet(game.getActivePlayers(firstTeamName, 0), firstTeamStarters);
            allPlayersInSet(game.getActivePlayers(secondTeamName, 0), secondTeamStarters);

            const lastCycleIndex: number = game.cycles.length - 1;
            allPlayersInSet(game.getActivePlayers(firstTeamName, lastCycleIndex), firstTeamStarters);
            allPlayersInSet(game.getActivePlayers(secondTeamName, lastCycleIndex), secondTeamStarters);
        });
        it("Some non-starters, all subbed", () => {
            const game: GameState = new GameState();
            game.setCycles([new Cycle(), new Cycle(), new Cycle()]);
            game.addPlayers(allPlayers);

            const lastCycleIndex: number = game.cycles.length - 1;
            const subCycleIndex = 1;

            game.cycles[subCycleIndex].addSwapSubstitution(firstTeamSub, firstTeamStarter);
            game.cycles[subCycleIndex].addSwapSubstitution(secondTeamSub, secondTeamStarter);

            expect(game.getPlayers(firstTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === firstTeamName)
            );
            expect(game.getPlayers(secondTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === secondTeamName)
            );

            allPlayersInSet(game.getActivePlayers(firstTeamName, 0), firstTeamStarters);
            allPlayersInSet(game.getActivePlayers(secondTeamName, 0), secondTeamStarters);

            const firstTeamAfterSub: Player[] = [firstTeamSub, anotherFirstTeamStarter];
            const secondTeamAfterSub: Player[] = [secondTeamSub, anotherSecondTeamStarter];

            allPlayersInSet(game.getActivePlayers(firstTeamName, subCycleIndex), firstTeamAfterSub);
            allPlayersInSet(game.getActivePlayers(secondTeamName, subCycleIndex), secondTeamAfterSub);
            allPlayersInSet(game.getActivePlayers(firstTeamName, lastCycleIndex), firstTeamAfterSub);
            allPlayersInSet(game.getActivePlayers(secondTeamName, lastCycleIndex), secondTeamAfterSub);
        });
        it("New player joins", () => {
            const game: GameState = new GameState();
            game.setCycles([new Cycle(), new Cycle(), new Cycle()]);
            game.addPlayers(allPlayers);

            const lastCycleIndex: number = game.cycles.length - 1;
            const joinCycleIndex = 1;

            const newFirstTeamPlayer = new Player("Antonio", firstTeamName, /* isStarter */ false);
            const newSecondTeamPlayer = new Player("Belle", secondTeamName, /* isStarter */ false);

            game.addPlayers([newFirstTeamPlayer, newSecondTeamPlayer]);
            game.cycles[joinCycleIndex].addPlayerJoins(newFirstTeamPlayer);
            game.cycles[joinCycleIndex].addPlayerJoins(newSecondTeamPlayer);

            expect(game.getPlayers(firstTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === firstTeamName).concat(newFirstTeamPlayer)
            );
            expect(game.getPlayers(secondTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === secondTeamName).concat(newSecondTeamPlayer)
            );

            allPlayersInSet(game.getActivePlayers(firstTeamName, 0), firstTeamStarters);
            allPlayersInSet(game.getActivePlayers(secondTeamName, 0), secondTeamStarters);

            const firstTeamAfterSub: Player[] = firstTeamStarters.concat(newFirstTeamPlayer);
            const secondTeamAfterSub: Player[] = secondTeamStarters.concat(newSecondTeamPlayer);

            allPlayersInSet(game.getActivePlayers(firstTeamName, joinCycleIndex), firstTeamAfterSub);
            allPlayersInSet(game.getActivePlayers(secondTeamName, joinCycleIndex), secondTeamAfterSub);
            allPlayersInSet(game.getActivePlayers(firstTeamName, lastCycleIndex), firstTeamAfterSub);
            allPlayersInSet(game.getActivePlayers(secondTeamName, lastCycleIndex), secondTeamAfterSub);
        });
        it("Player leaves", () => {
            const game: GameState = new GameState();
            game.setCycles([new Cycle(), new Cycle(), new Cycle()]);
            game.addPlayers(allPlayers);

            const lastCycleIndex: number = game.cycles.length - 1;
            const joinCycleIndex = 1;

            game.cycles[joinCycleIndex].addPlayerLeaves(anotherFirstTeamStarter);
            game.cycles[joinCycleIndex].addPlayerLeaves(anotherSecondTeamStarter);

            expect(game.getPlayers(firstTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === firstTeamName)
            );
            expect(game.getPlayers(secondTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === secondTeamName)
            );

            allPlayersInSet(game.getActivePlayers(firstTeamName, 0), firstTeamStarters);
            allPlayersInSet(game.getActivePlayers(secondTeamName, 0), secondTeamStarters);

            const firstTeamAfterLeave: Player[] = firstTeamStarters.filter(
                (player) => player !== anotherFirstTeamStarter
            );
            const secondTeamAfterLeave: Player[] = secondTeamStarters.filter(
                (player) => player !== anotherSecondTeamStarter
            );

            allPlayersInSet(game.getActivePlayers(firstTeamName, joinCycleIndex), firstTeamAfterLeave);
            allPlayersInSet(game.getActivePlayers(secondTeamName, joinCycleIndex), secondTeamAfterLeave);
            allPlayersInSet(game.getActivePlayers(firstTeamName, lastCycleIndex), firstTeamAfterLeave);
            allPlayersInSet(game.getActivePlayers(secondTeamName, lastCycleIndex), secondTeamAfterLeave);
        });
        it("Subbed in then subbed out", () => {
            const game: GameState = new GameState();
            game.setCycles([new Cycle(), new Cycle(), new Cycle()]);
            game.addPlayers(allPlayers);

            const lastCycleIndex: number = game.cycles.length - 1;
            const subCycleIndex: number = lastCycleIndex - 1;

            game.cycles[subCycleIndex].addSwapSubstitution(firstTeamSub, firstTeamStarter);
            game.cycles[subCycleIndex].addSwapSubstitution(secondTeamSub, secondTeamStarter);

            game.cycles[lastCycleIndex].addSwapSubstitution(firstTeamStarter, firstTeamSub);
            game.cycles[lastCycleIndex].addSwapSubstitution(secondTeamStarter, secondTeamSub);

            expect(game.getPlayers(firstTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === firstTeamName)
            );
            expect(game.getPlayers(secondTeamName)).to.deep.equal(
                allPlayers.filter((player) => player.teamName === secondTeamName)
            );

            allPlayersInSet(game.getActivePlayers(firstTeamName, 0), firstTeamStarters);
            allPlayersInSet(game.getActivePlayers(secondTeamName, 0), secondTeamStarters);

            const firstTeamAfterSub: Player[] = [firstTeamSub, anotherFirstTeamStarter];
            const secondTeamAfterSub: Player[] = [secondTeamSub, anotherSecondTeamStarter];

            allPlayersInSet(game.getActivePlayers(firstTeamName, subCycleIndex), firstTeamAfterSub);
            allPlayersInSet(game.getActivePlayers(secondTeamName, subCycleIndex), secondTeamAfterSub);
            allPlayersInSet(game.getActivePlayers(firstTeamName, lastCycleIndex), firstTeamStarters);
            allPlayersInSet(game.getActivePlayers(secondTeamName, lastCycleIndex), secondTeamStarters);
        });
        // Should have some strange ones, like same person leaving and joining. May be a reason to move away from type
        // and move to implicit ordering (join before leave, swap in-between)
    });
});

function allPlayersInSet(set: Set<Player>, expectedPlayers: Player[]): void {
    expect(set).to.have.all.keys(expectedPlayers);
}
