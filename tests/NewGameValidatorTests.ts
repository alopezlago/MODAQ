import { expect } from "chai";

import * as NewGameValidator from "src/state/NewGameValidator";
import { IPendingNewGame } from "src/state/IPendingNewGame";
import { Player } from "src/state/TeamState";
import { PacketState } from "src/state/PacketState";

describe("NewGameValidatorTests", () => {
    describe("playerTeamsUnique", () => {
        it("Team names unique", () => {
            const result: string | undefined = NewGameValidator.playerTeamsUnique(
                [new Player("a", "teamA", false)],
                [new Player("b", "teamB", false)]
            );
            expect(result).to.equal(undefined);
        });
        it("Team names not unique", () => {
            const result: string | undefined = NewGameValidator.playerTeamsUnique(
                [new Player("a", "teamB", false)],
                [new Player("b", "teamB", false)]
            );
            expect(result).to.not.equal(undefined);
        });
    });

    // In this method, the player array should already contain the new name once
    describe("newPlayerNameUnique", () => {
        // Is unique
        it("No players", () => {
            const result: string | undefined = NewGameValidator.newPlayerNameUnique([], "a");
            expect(result).to.equal(undefined);
        });
        it("Empty new name", () => {
            const result: string | undefined = NewGameValidator.newPlayerNameUnique([new Player("", "", false)], "");
            expect(result).to.equal(undefined);
        });
        it("Name in list", () => {
            const name = "copy";
            const result: string | undefined = NewGameValidator.newPlayerNameUnique(
                [new Player("old", "", false), new Player(name, "", false), new Player(name, "", false)],
                name
            );
            expect(result).to.not.equal(undefined);
        });
        it("Trimmed name in list", () => {
            const name = "copy ";
            const trimmedName: string = name.trim();
            const result: string | undefined = NewGameValidator.newPlayerNameUnique(
                [new Player(name, "", false), new Player(name, "", false), new Player(trimmedName, "", false)],
                name + " "
            );
            expect(result).to.not.equal(undefined);
        });
        it("Name not in list twice", () => {
            const result: string | undefined = NewGameValidator.newPlayerNameUnique(
                [new Player("old", "", false), new Player("unique", "", false)],
                "unique"
            );
            expect(result).to.equal(undefined);
        });
    });
    describe("isValid", () => {
        const defaultPacket: PacketState = new PacketState();
        defaultPacket.setTossups([
            {
                question: "Test question",
                answer: "answer",
            },
        ]);

        it("No players in first team", () => {
            assertNewGameIsInvalid({
                firstTeamPlayers: [],
                secondTeamPlayers: [new Player("b", "2", true)],
                packet: defaultPacket,
            });
        });
        it("No players in second team", () => {
            assertNewGameIsInvalid({
                firstTeamPlayers: [new Player("a", "1", true)],
                secondTeamPlayers: [],
                packet: defaultPacket,
            });
        });
        it("Only empty names in first team", () => {
            assertNewGameIsInvalid({
                firstTeamPlayers: [new Player("", "1", true)],
                secondTeamPlayers: [new Player("b", "2", true)],
                packet: defaultPacket,
            });
        });
        it("Only empty names in second team", () => {
            assertNewGameIsInvalid({
                firstTeamPlayers: [new Player("a", "1", true)],
                secondTeamPlayers: [new Player("", "2", true)],
                packet: defaultPacket,
            });
        });
        it("Same player names in first team", () => {
            assertNewGameIsInvalid({
                firstTeamPlayers: [new Player("a", "1", true), new Player("aa", "1", true), new Player("a", "1", true)],
                secondTeamPlayers: [new Player("b", "2", true)],
                packet: defaultPacket,
            });
        });
        it("Same player names in second team", () => {
            assertNewGameIsInvalid({
                firstTeamPlayers: [new Player("a", "1", true)],
                secondTeamPlayers: [
                    new Player("b", "2", true),
                    new Player("bb", "2", true),
                    new Player("b", "2", true),
                ],
                packet: defaultPacket,
            });
        });
        it("No tossups in packet", () => {
            assertNewGameIsInvalid({
                firstTeamPlayers: [new Player("a", "1", true)],
                secondTeamPlayers: [new Player("b", "2", true)],
                packet: new PacketState(),
            });
        });
        it("Valid game", () => {
            const newGame: IPendingNewGame = {
                firstTeamPlayers: [new Player("a", "1", true)],
                secondTeamPlayers: [new Player("b", "2", true)],
                packet: defaultPacket,
            };
            const result: boolean = NewGameValidator.isValid(newGame);
            expect(result).to.be.true;
        });
    });
});

function assertNewGameIsInvalid(newGame: IPendingNewGame): void {
    const result: boolean = NewGameValidator.isValid(newGame);
    expect(result).to.be.false;
}
