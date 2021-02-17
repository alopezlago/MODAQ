import { assert, expect } from "chai";

import * as Sheets from "src/sheets/Sheets";
import { ISheetsApi, ISheetsGetResponse } from "src/sheets/ISheetsApi";
import { AppState } from "src/state/AppState";
import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";
import { IPendingNewGame, PendingGameType } from "src/state/IPendingNewGame";
import { ExportState, LoadingState } from "src/state/SheetState";
import { IStatus } from "src/IStatus";
import { Player } from "src/state/TeamState";
import { PacketState, Tossup, Bonus } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";

const defaultMockSheetsApi: ISheetsApi = {
    batchClear: () => Promise.resolve({ isError: false, status: "" }),
    batchUpdate: () => Promise.resolve({ isError: false, status: "" }),
    initializeIfNeeded: () => Promise.resolve(),
    get: () =>
        Promise.resolve<ISheetsGetResponse>({
            success: true,
            valueRange: {
                values: [],
            },
        }),
};

function createMockApi(mocks: Partial<ISheetsApi>): ISheetsApi {
    const sheetsApi: ISheetsApi = { ...defaultMockSheetsApi, ...mocks };
    return sheetsApi;
}

function createAppStateForExport(): AppState {
    const appState: AppState = {
        game: new GameState(),
        uiState: new UIState(),
    };

    appState.game.addPlayers([new Player("Alice", "Alpha", true), new Player("Bob", "Beta", true)]);

    const packet: PacketState = new PacketState();
    packet.setTossups([new Tossup("This tossup has five words.", "A")]);
    packet.setBonuses([
        new Bonus("Leadin", [
            { question: "Part 1", answer: "A1", value: 10 },
            { question: "Part 2", answer: "A2", value: 10 },
            { question: "Part 3", answer: "A3", value: 10 },
        ]),
    ]);

    appState.game.loadPacket(packet);

    appState.uiState.setSheetsId("1");

    return appState;
}

function createAppStateForRosters(): AppState {
    const appState: AppState = {
        game: new GameState(),
        uiState: new UIState(),
    };

    appState.uiState.createPendingNewGame();
    appState.uiState.setPendingNewGameType(PendingGameType.Lifsheets);
    appState.uiState.setSheetsId("1");

    return appState;
}

function findPlayerOnTeam(appState: AppState, teamName: string): Player {
    const player: Player | undefined = appState.game.players.find((player) => player.teamName === teamName);
    if (player == undefined) {
        // Use an if since we want to coerce away the undefined type
        assert.fail("No players on team Alpha");
    }

    return player;
}

async function verifyExportToSheetsError(
    appState: AppState,
    sheetsApi: ISheetsApi,
    errorMessage: string
): Promise<void> {
    await Sheets.exportToSheet(appState, sheetsApi);

    expect(appState.uiState.sheetsState).to.exist;
    expect(appState.uiState.sheetsState.exportStatus?.isError).to.exist;
    expect(appState.uiState.sheetsState.exportStatus?.isError).to.be.true;
    expect(appState.uiState.sheetsState.exportStatus?.status).to.equal(errorMessage);
    expect(appState.uiState.sheetsState.exportState).to.equal(ExportState.Error);
}

async function verifyExportToSheetSuccess(
    appState: AppState,
    verifyCells: (ranges: gapi.client.sheets.ValueRange[]) => void
): Promise<void> {
    let ranges: gapi.client.sheets.ValueRange[] = [];
    const mockSheetsApi: ISheetsApi = createMockApi({
        batchUpdate: (_uiState, valueRanges) => {
            ranges = valueRanges;

            return Promise.resolve<IStatus>({
                isError: false,
                status: "",
            });
        },
    });

    await Sheets.exportToSheet(appState, mockSheetsApi);

    expect(appState.uiState.sheetsState).to.exist;
    expect(appState.uiState.sheetsState.exportStatus?.isError).to.exist;
    expect(appState.uiState.sheetsState.exportStatus?.isError).to.be.false;
    expect(appState.uiState.sheetsState.exportState).to.equal(ExportState.Success);

    verifyCells(ranges);
}

async function verifyLoadRostersError(appState: AppState, sheetsApi: ISheetsApi, errorMessage: string): Promise<void> {
    await Sheets.loadRosters(appState, sheetsApi);

    expect(appState.uiState.sheetsState).to.exist;
    expect(appState.uiState.sheetsState.rosterLoadStatus?.isError).to.exist;
    expect(appState.uiState.sheetsState.rosterLoadStatus?.isError).to.be.true;
    expect(appState.uiState.sheetsState.rosterLoadStatus?.status).to.equal(errorMessage);
    expect(appState.uiState.sheetsState.rosterLoadState).to.equal(LoadingState.Error);
}

function verifyCell(ranges: gapi.client.sheets.ValueRange[], cellRange: string, value: string | number): void {
    const cell: gapi.client.sheets.ValueRange | undefined = ranges.find(
        (range) => range.range === `'Round 1'!${cellRange}`
    );
    if (cell == undefined) {
        assert.fail(`Couldn't find update for cell at ${cellRange}. Ranges: ${JSON.stringify(ranges)}`);
    } else if (cell.values == undefined) {
        assert.fail(`No values in the update. Ranges: ${JSON.stringify(ranges)}`);
    }

    expect(cell.values.length).to.equal(1);
    expect(cell.values[0].length).to.equal(1);
    expect(cell.values[0][0]).to.equal(value);
}

describe("SheetsTests", () => {
    describe("exportToSheet", () => {
        // TODO: Should we have a test for when a player is subbed in on the second question? Conflicts with "Out"/"In",
        // but I don't know how Lifsheets tries to account for that
        // TODO: Any tests with AddPlayer? Doesn't make sense with Lifsheets, where the roster exists elsewhere...
        it("First team neg written to sheet", async () => {
            const appState: AppState = createAppStateForExport();

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 1;
            appState.game.cycles[0].addNeg(
                {
                    correct: false,
                    player,
                    position,
                },
                0
            );

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "B8", -5);
                verifyCell(ranges, "AJ8", position);
            });
        });
        it("Second team neg written to sheet", async () => {
            const appState: AppState = createAppStateForExport();

            const player: Player = findPlayerOnTeam(appState, "Beta");
            const position = 1;
            appState.game.cycles[0].addNeg(
                {
                    correct: false,
                    player,
                    position,
                },
                0
            );

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "R8", -5);
                verifyCell(ranges, "AJ8", position);
            });
        });
        it("First team correct buzz written to sheet", async () => {
            const appState: AppState = createAppStateForExport();

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 2;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    correct: true,
                    player,
                    position,
                },
                0,
                0
            );
            cycle.setBonusPartAnswer(0, true, 10);
            cycle.setBonusPartAnswer(1, true, 10);
            cycle.setBonusPartAnswer(2, false, 0);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "B8", 10);
                verifyCell(ranges, "AJ8", position);

                // Verify bonus
                verifyCell(ranges, "H8", "110");
            });
        });
        it("Second team correct buzz written to sheet", async () => {
            const appState: AppState = createAppStateForExport();

            const player: Player = findPlayerOnTeam(appState, "Beta");
            const position = 2;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    correct: true,
                    player,
                    position,
                },
                0,
                0
            );
            cycle.setBonusPartAnswer(0, false, 10);
            cycle.setBonusPartAnswer(1, false, 10);
            cycle.setBonusPartAnswer(2, true, 0);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "R8", 10);
                verifyCell(ranges, "AJ8", position);

                // Verify bonus
                verifyCell(ranges, "X8", "001");
            });
        });
        it("Two buzzes in same cycle", async () => {
            const appState: AppState = createAppStateForExport();

            const firstTeamPlayer: Player = findPlayerOnTeam(appState, "Alpha");
            const secondTeamPlayer: Player = findPlayerOnTeam(appState, "Beta");
            const negPosition = 2;
            const correctPosition = 4;

            const cycle: Cycle = appState.game.cycles[0];
            cycle.addNeg(
                {
                    correct: false,
                    player: secondTeamPlayer,
                    position: negPosition,
                },
                0
            );
            cycle.addCorrectBuzz(
                {
                    correct: true,
                    player: firstTeamPlayer,
                    position: correctPosition,
                },
                0,
                0
            );
            cycle.setBonusPartAnswer(0, false, 10);
            cycle.setBonusPartAnswer(1, true, 10);
            cycle.setBonusPartAnswer(2, true, 0);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "R8", -5);
                verifyCell(ranges, "B8", 10);
                verifyCell(ranges, "AJ8", negPosition);
                verifyCell(ranges, "AK8", correctPosition);

                // Verify bonus
                verifyCell(ranges, "H8", "011");
            });
        });
        it("First team tossup protest written to sheet", async () => {
            const appState: AppState = createAppStateForExport();

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 1;
            appState.game.cycles[0].addNeg(
                {
                    correct: false,
                    player,
                    position,
                },
                0
            );

            const reason = "I was right";
            appState.game.cycles[0].addTossupProtest("Alpha", 0, position, reason);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "B8", -5);
                verifyCell(ranges, "AF8", reason);
            });
        });
        it("Second team tossup protest written to sheet", async () => {
            const appState: AppState = createAppStateForExport();

            const player: Player = findPlayerOnTeam(appState, "Beta");
            const position = 1;
            appState.game.cycles[0].addNeg(
                {
                    correct: false,
                    player,
                    position,
                },
                0
            );

            const reason = "I was surely right";
            appState.game.cycles[0].addTossupProtest("Beta", 0, position, reason);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "R8", -5);
                verifyCell(ranges, "AG8", reason);
            });
        });
        it("First team bonus protest written to sheet", async () => {
            const appState: AppState = createAppStateForExport();

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 1;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    correct: true,
                    player,
                    position,
                },
                0,
                0
            );

            cycle.setBonusPartAnswer(0, false, 10);
            cycle.setBonusPartAnswer(1, true, 10);
            cycle.setBonusPartAnswer(2, true, 0);

            const reason = "I was right";
            cycle.addBonusProtest(0, 0, reason);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "B8", 10);
                verifyCell(ranges, "H8", "011");
                verifyCell(ranges, "AH8", reason);
            });
        });
        it("Second team bonus protest written to sheet", async () => {
            const appState: AppState = createAppStateForExport();

            const player: Player = findPlayerOnTeam(appState, "Beta");
            const position = 2;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    correct: true,
                    player,
                    position,
                },
                0,
                0
            );

            cycle.setBonusPartAnswer(0, true, 10);
            cycle.setBonusPartAnswer(1, false, 10);
            cycle.setBonusPartAnswer(2, true, 0);

            const reason = "I was surely right";
            cycle.addBonusProtest(0, 1, reason);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "R8", 10);
                verifyCell(ranges, "X8", "101");
                verifyCell(ranges, "AH8", reason);
            });
        });
        it("Multiple bonus protests written to sheet", async () => {
            const appState: AppState = createAppStateForExport();

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 1;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    correct: true,
                    player,
                    position,
                },
                0,
                0
            );

            cycle.setBonusPartAnswer(0, false, 10);
            cycle.setBonusPartAnswer(1, true, 10);
            cycle.setBonusPartAnswer(2, false, 0);

            const firstReason = "I was right";
            const secondReason = "That was also right";
            cycle.addBonusProtest(0, 0, firstReason);
            cycle.addBonusProtest(0, 2, secondReason);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "B8", 10);
                verifyCell(ranges, "H8", "010");
                verifyCell(ranges, "AH8", [firstReason, secondReason].join("\n"));
            });
        });
        it("First team subs", async () => {
            const appState: AppState = createAppStateForExport();

            const starter: Player = findPlayerOnTeam(appState, "Alpha");
            const sub = new Player("Adam", "Alpha", /* isStarter */ false);
            appState.game.addPlayer(sub);

            const packet: PacketState = new PacketState();
            const tossups: Tossup[] = [];
            for (let i = 0; i < 4; i++) {
                tossups.push(new Tossup(`TU${i}`, `Answer ${i}`));
            }

            packet.setTossups(tossups);
            appState.game.loadPacket(packet);

            // Swap in the 3rd phase
            appState.game.cycles[2].addSwapSubstitution(sub, starter);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                // All subs should start with "Out"
                verifyCell(ranges, "C8", "Out");

                // The subbed out player should have Out in the cycle they were subbed out, and the subbed in player
                // should have In in the previous cycle
                verifyCell(ranges, "B10", "Out");
                verifyCell(ranges, "C9", "In");
            });
        });
        it("Second team subs", async () => {
            const appState: AppState = createAppStateForExport();

            const starter: Player = findPlayerOnTeam(appState, "Beta");
            const sub = new Player("Barbara", "Beta", /* isStarter */ false);
            appState.game.addPlayer(sub);

            const packet: PacketState = new PacketState();
            const tossups: Tossup[] = [];
            for (let i = 0; i < 4; i++) {
                tossups.push(new Tossup(`TU${i}`, `Answer ${i}`));
            }

            packet.setTossups(tossups);
            appState.game.loadPacket(packet);

            // Swap in the 4th phase
            appState.game.cycles[3].addSwapSubstitution(sub, starter);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                // All subs should start with "Out"
                verifyCell(ranges, "S8", "Out");

                // The subbed out player should have Out in the cycle they were subbed out, and the subbed in player
                // should have In in the previous cycle
                verifyCell(ranges, "R11", "Out");
                verifyCell(ranges, "S10", "In");
            });
        });
        it("batchClear API failure", async () => {
            const appState: AppState = createAppStateForExport();

            const status = "Couldn't connect to Sheets";

            const mockSheetsApi: ISheetsApi = createMockApi({
                batchClear: () =>
                    Promise.resolve<IStatus>({
                        isError: true,
                        status,
                    }),
            });

            await verifyExportToSheetsError(
                appState,
                mockSheetsApi,
                `Error from Sheets API clearing the values. Error: ${status}`
            );
        });
        it("batchUpdate API failure", async () => {
            const appState: AppState = createAppStateForExport();

            const status = "Couldn't connect to Sheets";

            const mockSheetsApi: ISheetsApi = createMockApi({
                batchUpdate: () =>
                    Promise.resolve<IStatus>({
                        isError: true,
                        status,
                    }),
            });

            await verifyExportToSheetsError(
                appState,
                mockSheetsApi,
                `Error from Sheets API writing the values. Error: ${status}`
            );
        });
        it("Missing SheetsId", async () => {
            const appState: AppState = createAppStateForExport();

            appState.uiState.resetSheetsId();

            await verifyExportToSheetsError(appState, defaultMockSheetsApi, "Export requires a sheet ID");
        });
        it("More than two teams", async () => {
            const appState: AppState = createAppStateForExport();

            appState.game.addPlayer(new Player("Gail", "Gamma", true));

            await verifyExportToSheetsError(
                appState,
                defaultMockSheetsApi,
                "Export not allowed with more than two teams"
            );
        });
        it("Six players on a team succeeds", async () => {
            const appState: AppState = createAppStateForExport();

            const alphaPlayersCount: number = appState.game.players.filter((player) => player.teamName === "Alpha")
                .length;
            for (let i = 0; i < 6 - alphaPlayersCount; i++) {
                appState.game.addPlayer(new Player(`New${i}`, "Alpha", false));
            }

            await Sheets.exportToSheet(appState, defaultMockSheetsApi);

            expect(appState.uiState.sheetsState).to.exist;
            expect(appState.uiState.sheetsState.exportStatus?.isError).to.exist;
            expect(appState.uiState.sheetsState.exportStatus?.isError).to.be.false;
            expect(appState.uiState.sheetsState.exportState).to.equal(ExportState.Success);
        });
        it("Seven players on a team fails", async () => {
            const appState: AppState = createAppStateForExport();

            const alphaPlayersCount: number = appState.game.players.filter((player) => player.teamName === "Alpha")
                .length;
            for (let i = 0; i < 7 - alphaPlayersCount; i++) {
                appState.game.addPlayer(new Player(`New${i}`, "Alpha", false));
            }

            await verifyExportToSheetsError(
                appState,
                defaultMockSheetsApi,
                "Export not allowed with more than six players per a team"
            );
        });
        it("Twenty-one cycles succeeds", async () => {
            const appState: AppState = createAppStateForExport();

            const packet: PacketState = new PacketState();
            const tossups: Tossup[] = [];
            for (let i = 0; i < 21; i++) {
                tossups.push(new Tossup(`TU${i}`, `Answer ${i}`));
            }

            packet.setTossups(tossups);

            appState.game.loadPacket(packet);

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 3;
            appState.game.cycles[20].addCorrectBuzz(
                {
                    correct: true,
                    player,
                    position,
                },
                20,
                0
            );

            await verifyExportToSheetSuccess(appState, (ranges) => {
                // Verify that we do write to the last cell (the tiebreaker one)
                verifyCell(ranges, "B28", 10);
                verifyCell(ranges, "AJ28", position);
            });
        });
        it("Twenty-two cycles fails", async () => {
            const appState: AppState = createAppStateForExport();

            const packet: PacketState = new PacketState();
            const tossups: Tossup[] = [];
            for (let i = 0; i < 22; i++) {
                tossups.push(new Tossup(`TU${i}`, `Answer ${i}`));
            }

            packet.setTossups(tossups);

            appState.game.loadPacket(packet);

            await verifyExportToSheetsError(
                appState,
                defaultMockSheetsApi,
                "Export not allowed with more than 21 rounds (not enough rows)"
            );
        });
    });

    describe("getSheetsId", () => {
        const id = "ABCD";

        it("Success", () => {
            const url = `https://docs.google.com/spreadsheets/d/${id}`;
            const result: string | undefined = Sheets.getSheetsId(url);
            expect(result).to.equal(id);
        });
        it("ID trimmed", () => {
            const url = `https://docs.google.com/spreadsheets/d/${id}   `;
            const result: string | undefined = Sheets.getSheetsId(url);
            expect(result).to.equal(id);
        });
        it("ID read from subpath", () => {
            const url = `https://docs.google.com/spreadsheets/d/${id}/edit#gid=1234`;
            const result: string | undefined = Sheets.getSheetsId(url);
            expect(result).to.equal(id);
        });
        it("Non-google link returns undefined", () => {
            const url = `https://docs.microsoft.com/spreadsheets/d/ABCD`;
            const result: string | undefined = Sheets.getSheetsId(url);
            expect(result).to.not.exist;
        });
        it("Non-spreadsheet link returns undefined", () => {
            const url = `https://docs.google.com/docs/d/${id}`;
            const result: string | undefined = Sheets.getSheetsId(url);
            expect(result).to.not.exist;
        });
        it("Undefined returns undefined", () => {
            const result: string | undefined = Sheets.getSheetsId(undefined);
            expect(result).to.not.exist;
        });
    });

    describe("loadRosters", () => {
        it("Success", async () => {
            const appState: AppState = createAppStateForRosters();

            const firstRow: string[] = ["Alpha", "Alice", "Andrew", "Ana"];
            const secondRow: string[] = ["Beta", "Bob", "Barbara"];
            const thirdRow: string[] = ["Gamma", "Gabe", "Gina"];

            const mockSheetsApi: ISheetsApi = createMockApi({
                get: () =>
                    Promise.resolve<ISheetsGetResponse>({
                        success: true,
                        valueRange: {
                            values: [firstRow, secondRow, thirdRow],
                        },
                    }),
            });

            await Sheets.loadRosters(appState, mockSheetsApi);

            expect(appState.uiState.sheetsState).to.exist;
            expect(appState.uiState.sheetsState.rosterLoadStatus?.isError).to.exist;
            expect(appState.uiState.sheetsState.rosterLoadStatus?.isError).to.be.false;

            // Use an if here to remove the need for null coalescing
            if (appState.uiState.pendingNewGame == undefined) {
                assert.fail("PendingNewGame was undefined");
            }

            // Use an if here to get the type coercion benefits
            if (appState.uiState.pendingNewGame.type !== PendingGameType.Lifsheets) {
                assert.fail(
                    `PendingNewGame type should've been Lifsheets, but was ${appState.uiState.pendingNewGame?.type}`
                );
            }

            const pendingNewGame: IPendingNewGame = appState.uiState.pendingNewGame;
            const playerNamesFromRosters: string[] | undefined = pendingNewGame.playersFromRosters?.map(
                (player) => player.name
            );

            // Make sure all the players are loaded, and that the defaults are set
            expect(playerNamesFromRosters).to.exist;
            for (const name of firstRow.slice(1).concat(secondRow.slice(1)).concat(thirdRow.slice(1))) {
                expect(playerNamesFromRosters).to.contain(name);
            }

            expect(pendingNewGame.firstTeamPlayersFromRosters?.map((player) => player.name) ?? []).to.deep.equal(
                firstRow.slice(1)
            );
            expect(pendingNewGame.secondTeamPlayersFromRosters?.map((player) => player.name) ?? []).to.deep.equal(
                secondRow.slice(1)
            );
            expect(appState.uiState.sheetsState.rosterLoadState).to.equal(LoadingState.Loaded);
        });
        it("Zero teams", async () => {
            const appState: AppState = createAppStateForRosters();
            const mockSheetsApi: ISheetsApi = createMockApi({
                get: () =>
                    Promise.resolve<ISheetsGetResponse>({
                        success: true,
                        valueRange: {
                            values: [],
                        },
                    }),
            });

            await verifyLoadRostersError(appState, mockSheetsApi, "Not enough teams. Only found 0 team(s).");
        });
        it("Only one team", async () => {
            const appState: AppState = createAppStateForRosters();

            const mockSheetsApi: ISheetsApi = createMockApi({
                get: () =>
                    Promise.resolve<ISheetsGetResponse>({
                        success: true,
                        valueRange: {
                            values: [["Alpha", "Alice", "Andrew", "Ana"]],
                        },
                    }),
            });

            await verifyLoadRostersError(appState, mockSheetsApi, "Not enough teams. Only found 1 team(s).");
        });
        it("No players on a team", async () => {
            const appState: AppState = createAppStateForRosters();

            const teamOnlyRow = ["Gamma"];

            const mockSheetsApi: ISheetsApi = createMockApi({
                get: () =>
                    Promise.resolve<ISheetsGetResponse>({
                        success: true,
                        valueRange: {
                            values: [
                                ["Alpha", "Alice", "Andrew", "Ana"],
                                ["Beta", "Bob"],
                                teamOnlyRow,
                                ["Delta", "Diana"],
                            ],
                        },
                    }),
            });

            await verifyLoadRostersError(
                appState,
                mockSheetsApi,
                "Not all teams have players. Check the roster sheet to make sure at least 1 player is on each team."
            );
        });
        it("API failure", async () => {
            const appState: AppState = createAppStateForRosters();

            const errorMessage = "Couldn't connect to Sheets";

            const mockSheetsApi: ISheetsApi = createMockApi({
                get: () =>
                    Promise.resolve<ISheetsGetResponse>({
                        success: false,
                        errorMessage,
                    }),
            });

            await verifyLoadRostersError(
                appState,
                mockSheetsApi,
                `Load failed. Error from Sheets API: ${errorMessage}`
            );
        });
    });
});
