import { assert, expect } from "chai";
// import { flow, runInAction } from "mobx";

import * as GameFormats from "src/state/GameFormats";
import * as Sheets from "src/sheets/Sheets";
import { ISheetsApi, ISheetsBatchGetResponse, ISheetsGetResponse } from "src/sheets/ISheetsApi";
import { AppState } from "src/state/AppState";
import { UIState } from "src/state/UIState";
import { GameState } from "src/state/GameState";
import { IPendingFromSheetsNewGame, IPendingNewGame, PendingGameType } from "src/state/IPendingNewGame";
import { ExportState, LoadingState, SheetType } from "src/state/SheetState";
import { IStatus } from "src/IStatus";
import { Player } from "src/state/TeamState";
import { PacketState, Tossup, Bonus } from "src/state/PacketState";
import { Cycle } from "src/state/Cycle";
import { IGameFormat } from "src/state/IGameFormat";

const defaultMockSheetsApi: ISheetsApi = {
    batchClear: () => Promise.resolve({ isError: false, status: "" }),
    batchGet: () =>
        Promise.resolve<ISheetsBatchGetResponse>({
            success: true,
            valueRanges: [],
        }),
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

function createAppStateForExport(sheetType: SheetType = SheetType.Lifsheets): AppState {
    //return runInAction(() => {
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

    appState.uiState.sheetsState.setSheetId("1");
    appState.uiState.sheetsState.setSheetType(sheetType);

    return appState;
    //});
}

function createAppStateForRosters(
    sheetType: SheetType = SheetType.Lifsheets,
    pendingGameType: PendingGameType = PendingGameType.Lifsheets
): AppState {
    //return runInAction(() => {
    const appState: AppState = {
        game: new GameState(),
        uiState: new UIState(),
    };

    appState.uiState.createPendingNewGame();
    appState.uiState.setPendingNewGameType(pendingGameType);
    appState.uiState.sheetsState.setSheetId("1");
    appState.uiState.sheetsState.setSheetType(sheetType);

    return appState;
    //});
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
    //await flow(function* () {
    await Sheets.exportToSheet(appState, sheetsApi);

    expect(appState.uiState.sheetsState).to.exist;
    expect(appState.uiState.sheetsState.exportStatus?.isError).to.exist;
    expect(appState.uiState.sheetsState.exportStatus?.isError).to.be.true;
    expect(appState.uiState.sheetsState.exportStatus?.status).to.equal(errorMessage);
    expect(appState.uiState.sheetsState.exportState).to.equal(ExportState.Error);
    //});
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

    // We use a flow here since it greatly simplifies using a reactive context with asynchronous code.
    // See https://www.mobxjs.com/best/actions.html and https://mobx.js.org/actions.html#using-flow-instead-of-async--await-
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

function verifyUCSDBonusCells(
    ranges: gapi.client.sheets.ValueRange[],
    cellRange: string,
    values: [boolean, boolean, boolean]
): void {
    const cell: gapi.client.sheets.ValueRange | undefined = ranges.find(
        (range) => range.range === `'Round 1'!${cellRange}`
    );
    if (cell == undefined) {
        assert.fail(`Couldn't find update for cell at I4:K4. Ranges: ${JSON.stringify(ranges)}`);
    } else if (cell.values == undefined) {
        assert.fail(`No values in the update. Ranges: ${JSON.stringify(ranges)}`);
    }

    expect(cell.values.length).to.equal(1);
    expect(cell.values[0].length).to.equal(values.length);
    expect(cell.values[0]).to.deep.equal(values);
}

describe("SheetsTests", () => {
    describe("exportToSheet", () => {
        // TODO: Should we have a test for when a player is subbed in on the second question? Conflicts with "Out"/"In",
        // but I don't know how Lifsheets tries to account for that
        // TODO: Any tests with AddPlayer? Doesn't make sense with Lifsheets, where the roster exists elsewhere...
        const firstTeamNegTest = async (
            sheetType: SheetType,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[], position: number) => void
        ): Promise<void> => {
            const appState: AppState = createAppStateForExport(sheetType);

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 1;
            appState.game.cycles[0].addWrongBuzz(
                {
                    player,
                    position,
                    points: -5,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat
            );

            await verifyExportToSheetSuccess(appState, (ranges) => verifyCells(ranges, position));
        };

        it("First team neg written to sheet (Lifsheets)", async () => {
            await firstTeamNegTest(SheetType.Lifsheets, (ranges, position) => {
                verifyCell(ranges, "B8", -5);
                verifyCell(ranges, "AJ8", position);
            });
        });
        it("First team neg written to sheet (TJSheets)", async () => {
            await firstTeamNegTest(SheetType.TJSheets, (ranges) => verifyCell(ranges, "C4", -5));
        });
        it("First team neg written to sheet (UCSDSheets)", async () => {
            await firstTeamNegTest(SheetType.UCSDSheets, (ranges) => verifyCell(ranges, "C4", -5));
        });

        const secondTeamNegTest = async (
            sheetType: SheetType,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[], position: number) => void
        ): Promise<void> => {
            const appState: AppState = createAppStateForExport(sheetType);

            const player: Player = findPlayerOnTeam(appState, "Beta");
            const position = 1;
            appState.game.cycles[0].addWrongBuzz(
                {
                    player,
                    position,
                    points: -5,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat
            );

            await verifyExportToSheetSuccess(appState, (ranges) => verifyCells(ranges, position));
        };
        it("Second team neg written to sheet (Lifsheets)", async () => {
            await secondTeamNegTest(SheetType.Lifsheets, (ranges, position) => {
                verifyCell(ranges, "R8", -5);
                verifyCell(ranges, "AJ8", position);
            });
        });
        it("Second team neg written to sheet (TJSheets)", async () => {
            await secondTeamNegTest(SheetType.TJSheets, (ranges) => verifyCell(ranges, "M4", -5));
        });
        it("Second team neg written to sheet (Lifsheets)", async () => {
            await secondTeamNegTest(SheetType.UCSDSheets, (ranges) => verifyCell(ranges, "O4", -5));
        });

        const firstCorrectBuzzTest = async (
            sheetType: SheetType,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[], position: number) => void
        ): Promise<void> => {
            const appState: AppState = createAppStateForExport(sheetType);

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 2;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    player,
                    position,
                    points: 10,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );
            cycle.setBonusPartAnswer(0, player.teamName, 10);
            cycle.setBonusPartAnswer(1, player.teamName, 10);
            cycle.setBonusPartAnswer(2, player.teamName, 0);

            await verifyExportToSheetSuccess(appState, (ranges) => verifyCells(ranges, position));
        };
        it("First team correct buzz written to sheet (Lifsheets)", async () => {
            await firstCorrectBuzzTest(SheetType.Lifsheets, (ranges, position) => {
                verifyCell(ranges, "B8", 10);
                verifyCell(ranges, "AJ8", position);

                // Verify bonus
                verifyCell(ranges, "H8", "110");
            });
        });
        it("First team correct buzz written to sheet (TJSheets)", async () => {
            await firstCorrectBuzzTest(SheetType.TJSheets, (ranges) => {
                verifyCell(ranges, "C4", 10);

                // Verify bonus
                verifyCell(ranges, "I4", 20);
            });
        });
        it("First team correct buzz written to sheet (UCSDSheets)", async () => {
            await firstCorrectBuzzTest(SheetType.UCSDSheets, (ranges) => {
                verifyCell(ranges, "C4", 10);

                // Verify bonus
                verifyUCSDBonusCells(ranges, "I4:K4", [true, true, false]);
            });
        });

        const secondCorrectBuzzTest = async (
            sheetType: SheetType,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[], position: number) => void
        ): Promise<void> => {
            const appState: AppState = createAppStateForExport(sheetType);

            const player: Player = findPlayerOnTeam(appState, "Beta");
            const position = 2;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    player,
                    position,
                    points: 10,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );
            cycle.setBonusPartAnswer(0, player.teamName, 0);
            cycle.setBonusPartAnswer(1, player.teamName, 0);
            cycle.setBonusPartAnswer(2, player.teamName, 10);

            await verifyExportToSheetSuccess(appState, (ranges) => verifyCells(ranges, position));
        };

        it("Second team correct buzz written to sheet (Lifsheets)", async () => {
            await secondCorrectBuzzTest(SheetType.Lifsheets, (ranges, position) => {
                verifyCell(ranges, "R8", 10);
                verifyCell(ranges, "AJ8", position);

                // Verify bonus
                verifyCell(ranges, "X8", "001");
            });
        });
        it("Second team correct buzz written to sheet (TJSheets)", async () => {
            await secondCorrectBuzzTest(SheetType.TJSheets, (ranges) => {
                verifyCell(ranges, "M4", 10);

                // Verify bonus
                verifyCell(ranges, "S4", 10);
            });
        });
        it("Second team correct buzz written to sheet (UCSDSheets)", async () => {
            await secondCorrectBuzzTest(SheetType.UCSDSheets, (ranges) => {
                verifyCell(ranges, "O4", 10);

                // Verify bonus
                verifyUCSDBonusCells(ranges, "U4:W4", [false, false, true]);
            });
        });

        const playerPowersTest = async (
            sheetType: SheetType,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[], position: number) => void
        ): Promise<void> => {
            const appState: AppState = createAppStateForExport(sheetType);

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 2;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    player,
                    position,
                    points: 15,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );
            cycle.setBonusPartAnswer(0, player.teamName, 10);
            cycle.setBonusPartAnswer(1, player.teamName, 10);
            cycle.setBonusPartAnswer(2, player.teamName, 0);

            await verifyExportToSheetSuccess(appState, (ranges) => verifyCells(ranges, position));
        };
        it("First team player powers written to sheet (Lifsheets)", async () => {
            await playerPowersTest(SheetType.Lifsheets, (ranges, position) => {
                verifyCell(ranges, "B8", 15);
                verifyCell(ranges, "AJ8", position);

                // Verify bonus
                verifyCell(ranges, "H8", "110");
            });
        });
        it("First team player powers written to sheet (TJSheets)", async () => {
            await playerPowersTest(SheetType.TJSheets, (ranges) => {
                verifyCell(ranges, "C4", 15);

                // Verify bonus
                verifyCell(ranges, "I4", 20);
            });
        });
        it("First team player powers written to sheet (UCSDSheets)", async () => {
            await playerPowersTest(SheetType.UCSDSheets, (ranges) => {
                verifyCell(ranges, "C4", 15);

                // Verify bonus
                verifyUCSDBonusCells(ranges, "I4:K4", [true, true, false]);
            });
        });

        const twoBuzzesInSameCycleTest = async (
            sheetType: SheetType,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[], negPosition: number, correctPosition: number) => void
        ): Promise<void> => {
            const appState: AppState = createAppStateForExport(sheetType);

            const firstTeamPlayer: Player = findPlayerOnTeam(appState, "Alpha");
            const secondTeamPlayer: Player = findPlayerOnTeam(appState, "Beta");
            const negPosition = 2;
            const correctPosition = 4;

            const cycle: Cycle = appState.game.cycles[0];
            cycle.addWrongBuzz(
                {
                    player: secondTeamPlayer,
                    position: negPosition,
                    points: -5,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat
            );
            cycle.addCorrectBuzz(
                {
                    player: firstTeamPlayer,
                    position: correctPosition,
                    points: 10,
                    isLastWord: true,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );
            cycle.setBonusPartAnswer(0, firstTeamPlayer.teamName, 10);
            cycle.setBonusPartAnswer(1, firstTeamPlayer.teamName, 10);
            cycle.setBonusPartAnswer(2, firstTeamPlayer.teamName, 0);

            await verifyExportToSheetSuccess(appState, (ranges) => verifyCells(ranges, negPosition, correctPosition));
        };

        it("Two buzzes in same cycle (Lifsheets)", async () => {
            await twoBuzzesInSameCycleTest(SheetType.Lifsheets, (ranges, negPosition, correctPosition) => {
                verifyCell(ranges, "R8", -5);
                verifyCell(ranges, "B8", 10);
                verifyCell(ranges, "AJ8", negPosition);
                verifyCell(ranges, "AK8", correctPosition);

                // Verify bonus
                verifyCell(ranges, "H8", "110");
            });
        });
        it("Two buzzes in same cycle (TJ Sheets)", async () => {
            await twoBuzzesInSameCycleTest(SheetType.TJSheets, (ranges) => {
                verifyCell(ranges, "M4", -5);
                verifyCell(ranges, "C4", 10);

                // Verify bonus
                verifyCell(ranges, "I4", 20);
            });
        });
        it("Two buzzes in same cycle (UCSDSheets)", async () => {
            await twoBuzzesInSameCycleTest(SheetType.UCSDSheets, (ranges) => {
                verifyCell(ranges, "O4", -5);
                verifyCell(ranges, "C4", 10);

                // Verify bonus
                verifyUCSDBonusCells(ranges, "I4:K4", [true, true, false]);
            });
        });

        it("First team tossup protest written to sheet", async () => {
            const appState: AppState = createAppStateForExport(SheetType.Lifsheets);

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 1;
            appState.game.cycles[0].addWrongBuzz(
                {
                    player,
                    position,
                    points: -5,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat
            );

            const reason = "I was right";
            appState.game.cycles[0].addTossupProtest("Alpha", 0, position, reason);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "B8", -5);
                verifyCell(ranges, "AF8", reason);
            });
        });
        it("Second team tossup protest written to sheet", async () => {
            const appState: AppState = createAppStateForExport(SheetType.Lifsheets);

            const player: Player = findPlayerOnTeam(appState, "Beta");
            const position = 1;
            appState.game.cycles[0].addWrongBuzz(
                {
                    player,
                    position,
                    points: -5,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat
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
                    player,
                    position,
                    points: 10,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );

            cycle.setBonusPartAnswer(0, player.teamName, 0);
            cycle.setBonusPartAnswer(1, player.teamName, 10);
            cycle.setBonusPartAnswer(2, player.teamName, 10);

            const reason = "I was right";
            cycle.addBonusProtest(0, 0, reason, "Alpha");

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "B8", 10);
                verifyCell(ranges, "H8", "011");
                verifyCell(ranges, "AH8", reason);
            });
        });
        it("Second team bonus protest written to sheet", async () => {
            const appState: AppState = createAppStateForExport(SheetType.Lifsheets);

            const player: Player = findPlayerOnTeam(appState, "Beta");
            const position = 2;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    player,
                    position,
                    points: 10,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );

            cycle.setBonusPartAnswer(0, player.teamName, 10);
            cycle.setBonusPartAnswer(1, player.teamName, 0);
            cycle.setBonusPartAnswer(2, player.teamName, 10);

            const reason = "I was surely right";
            cycle.addBonusProtest(0, 1, reason, "Beta");

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "R8", 10);
                verifyCell(ranges, "X8", "101");
                verifyCell(ranges, "AH8", reason);
            });
        });
        it("Multiple bonus protests written to sheet", async () => {
            const appState: AppState = createAppStateForExport(SheetType.Lifsheets);

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 1;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    player,
                    position,
                    points: 10,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );

            cycle.setBonusPartAnswer(0, player.teamName, 0);
            cycle.setBonusPartAnswer(1, player.teamName, 10);
            cycle.setBonusPartAnswer(2, player.teamName, 0);

            const firstReason = "I was right";
            const secondReason = "That was also right";
            cycle.addBonusProtest(0, 0, firstReason, "Alpha");
            cycle.addBonusProtest(0, 2, secondReason, "Alpha");

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "B8", 10);
                verifyCell(ranges, "H8", "010");
                verifyCell(ranges, "AH8", [firstReason, secondReason].join("\n"));
            });
        });

        it("First team bouncebacks written to sheet (TJ Sheets)", async () => {
            const appState: AppState = createAppStateForExport(SheetType.TJSheets);
            appState.game.gameFormat = { ...appState.game.gameFormat, bonusesBounceBack: true };

            const player: Player = findPlayerOnTeam(appState, "Beta");
            const position = 1;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    player,
                    position,
                    points: 10,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );

            cycle.setBonusPartAnswer(0, player.teamName, 10);
            cycle.setBonusPartAnswer(1, "Alpha", 10);
            cycle.setBonusPartAnswer(2, "Alpha", 10);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "M4", 10);
                verifyCell(ranges, "S4", 10);
                verifyCell(ranges, "J4", 20);
            });
        });
        it("Second team bouncebacks written to sheet (TJ Sheets)", async () => {
            const appState: AppState = createAppStateForExport(SheetType.TJSheets);
            appState.game.gameFormat = { ...appState.game.gameFormat, bonusesBounceBack: true };

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 1;
            const cycle: Cycle = appState.game.cycles[0];
            cycle.addCorrectBuzz(
                {
                    player,
                    position,
                    points: 10,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );

            cycle.setBonusPartAnswer(0, player.teamName, 10);
            cycle.setBonusPartAnswer(1, player.teamName, 10);
            cycle.setBonusPartAnswer(2, "Beta", 10);

            await verifyExportToSheetSuccess(appState, (ranges) => {
                verifyCell(ranges, "C4", 10);
                verifyCell(ranges, "I4", 20);
                verifyCell(ranges, "T4", 10);
            });
        });

        const firstTeamSubsTest = async (
            sheetType: SheetType,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[]) => void
        ) => {
            const appState: AppState = createAppStateForExport(sheetType);

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

            await verifyExportToSheetSuccess(appState, verifyCells);
        };

        it("First team subs (Lifsheets)", async () => {
            await firstTeamSubsTest(SheetType.Lifsheets, (ranges) => {
                // All subs should start with "Out"
                verifyCell(ranges, "C8", "Out");

                // The subbed out player should have Out in the cycle they were subbed out, and the subbed in player
                // should have In in the previous cycle
                verifyCell(ranges, "B10", "Out");
                verifyCell(ranges, "C9", "In");
            });
        });
        it("First team subs (TJSheets)", async () => {
            await firstTeamSubsTest(SheetType.TJSheets, (ranges) => {
                // All subs should start with "Out"
                verifyCell(ranges, "D3", "Adam");

                // Subbed on the 3rd question
                verifyCell(ranges, "D28", 3);
                verifyCell(ranges, "C29", 3);
            });
        });
        it("First team subs (UCSDSheets)", async () => {
            await firstTeamSubsTest(SheetType.UCSDSheets, (ranges) => {
                // There's no explicit substitution, just a count of how many tossups have been heard
                verifyCell(ranges, "C32", 2);
                verifyCell(ranges, "D32", 2);
                verifyCell(ranges, "O32", 4);
            });
        });

        const secondTeamSubsTest = async (
            sheetType: SheetType,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[]) => void
        ) => {
            const appState: AppState = createAppStateForExport(sheetType);

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

            await verifyExportToSheetSuccess(appState, verifyCells);
        };

        it("Second team subs (Lifsheets)", async () => {
            await secondTeamSubsTest(SheetType.Lifsheets, (ranges) => {
                // All subs should start with "Out"
                verifyCell(ranges, "S8", "Out");

                // The subbed out player should have Out in the cycle they were subbed out, and the subbed in player
                // should have In in the previous cycle
                verifyCell(ranges, "R11", "Out");
                verifyCell(ranges, "S10", "In");
            });
        });
        it("Second team subs (TJSheets)", async () => {
            await secondTeamSubsTest(SheetType.TJSheets, (ranges) => {
                // All subs should start with "Out"
                verifyCell(ranges, "N3", "Barbara");

                // Subbed on the 3rd question
                verifyCell(ranges, "N28", 4);
                verifyCell(ranges, "M29", 4);
            });
        });
        it("Second team subs (UCSDSheets)", async () => {
            await secondTeamSubsTest(SheetType.UCSDSheets, (ranges) => {
                // There's no explicit substitution, just a count of how many tossups have been heard
                verifyCell(ranges, "O32", 3);
                verifyCell(ranges, "P32", 1);
                verifyCell(ranges, "C32", 4);
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

        const moreThanTwoTeamsTest = async (sheetType: SheetType) => {
            const appState: AppState = createAppStateForExport(sheetType);

            appState.game.addPlayer(new Player("Gail", "Gamma", true));

            await verifyExportToSheetsError(
                appState,
                defaultMockSheetsApi,
                "Export not allowed with more than two teams"
            );
        };

        it("More than two teams (Lifsheets)", async () => {
            await moreThanTwoTeamsTest(SheetType.Lifsheets);
        });
        it("More than two teams (TJSheets)", async () => {
            await moreThanTwoTeamsTest(SheetType.TJSheets);
        });
        it("More than two teams (UCSDSheets)", async () => {
            await moreThanTwoTeamsTest(SheetType.UCSDSheets);
        });

        const sixPlayersOnTeamSucceedsTest = async (sheetType: SheetType) => {
            const appState: AppState = createAppStateForExport(sheetType);

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
        };

        it("Six players on a team succeeds (Lifsheets)", async () => {
            await sixPlayersOnTeamSucceedsTest(SheetType.Lifsheets);
        });
        it("Six players on a team succeeds (TJSheets)", async () => {
            await sixPlayersOnTeamSucceedsTest(SheetType.TJSheets);
        });
        it("Six players on a team succeeds (UCSDSheets)", async () => {
            await sixPlayersOnTeamSucceedsTest(SheetType.UCSDSheets);
        });

        const sevenPlayersOnTeamFailsTest = async (sheetType: SheetType) => {
            const appState: AppState = createAppStateForExport(sheetType);

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
        };

        it("Seven players on a team fails (Lifsheets)", async () => {
            await sevenPlayersOnTeamFailsTest(SheetType.Lifsheets);
        });
        it("Seven players on a team fails (TJSheets)", async () => {
            await sevenPlayersOnTeamFailsTest(SheetType.TJSheets);
        });
        it("Seven players on a team fails (UCSDSheets)", async () => {
            await sevenPlayersOnTeamFailsTest(SheetType.UCSDSheets);
        });

        const tossupLimitCycleSucceedsTest = async (
            sheetType: SheetType,
            tossupsScored: number,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[], position: number) => void
        ) => {
            const appState: AppState = createAppStateForExport(sheetType);

            const packet: PacketState = new PacketState();
            const tossups: Tossup[] = [];
            for (let i = 0; i < tossupsScored; i++) {
                tossups.push(new Tossup(`TU${i}`, `Answer ${i}`));
            }

            packet.setTossups(tossups);

            appState.game.loadPacket(packet);

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 3;
            appState.game.cycles[tossupsScored - 1].addCorrectBuzz(
                {
                    player,
                    position,
                    points: 10,
                    isLastWord: false,
                },
                20,
                appState.game.gameFormat,
                0,
                3
            );

            await verifyExportToSheetSuccess(appState, (ranges) => verifyCells(ranges, position));
        };

        it("Twenty-one cycles succeeds (Lifsheets)", async () => {
            await tossupLimitCycleSucceedsTest(SheetType.Lifsheets, 21, (ranges, position) => {
                // Verify that we do write to the last cell (the tiebreaker one)
                verifyCell(ranges, "B28", 10);
                verifyCell(ranges, "AJ28", position);
            });
        });
        it("Twenty-four cycles succeeds (TJSheets)", async () => {
            await tossupLimitCycleSucceedsTest(SheetType.TJSheets, 24, (ranges) => {
                // Verify that we do write to the last cell (the tiebreaker one)
                verifyCell(ranges, "C27", 10);
            });
        });
        it("Twenty-eight cycles succeeds (UCSDSheets)", async () => {
            await tossupLimitCycleSucceedsTest(SheetType.UCSDSheets, 28, (ranges) => {
                // Verify that we do write to the last cell (the tiebreaker one)
                verifyCell(ranges, "C31", 10);
            });
        });

        const pastTossupLimitCycleFailsTest = async (sheetType: SheetType, tossupsCount: number) => {
            const appState: AppState = createAppStateForExport(sheetType);

            const packet: PacketState = new PacketState();
            const tossups: Tossup[] = [];
            for (let i = 0; i < tossupsCount; i++) {
                tossups.push(new Tossup(`TU${i}`, `Answer ${i}`));
            }

            packet.setTossups(tossups);

            appState.game.loadPacket(packet);

            await verifyExportToSheetsError(
                appState,
                defaultMockSheetsApi,
                `Export not allowed with more than ${tossupsCount - 1} rounds (not enough rows)`
            );
        };

        it("Twenty-two cycles fails (Lifsheets)", async () => {
            await pastTossupLimitCycleFailsTest(SheetType.Lifsheets, 22);
        });
        it("Twenty-five cycles fails (TJSheets)", async () => {
            await pastTossupLimitCycleFailsTest(SheetType.TJSheets, 25);
        });
        it("Twenty-nine cycles fails (UCSDSheets)", async () => {
            await pastTossupLimitCycleFailsTest(SheetType.UCSDSheets, 29);
        });

        const onlyPlayedCyclesWrittenTest = async (
            sheetType: SheetType,
            verifyCells: (ranges: gapi.client.sheets.ValueRange[], position: number) => void
        ) => {
            const appState: AppState = createAppStateForExport(sheetType);
            const gameFormat: IGameFormat = { ...GameFormats.UndefinedGameFormat, regulationTossupCount: 1 };
            appState.game.setGameFormat(gameFormat);

            const packet: PacketState = new PacketState();
            const tossups: Tossup[] = [];
            for (let i = 0; i < 10; i++) {
                tossups.push(new Tossup(`TU${i}`, `Answer ${i}`));
            }

            packet.setTossups(tossups);

            appState.game.loadPacket(packet);

            const player: Player = findPlayerOnTeam(appState, "Alpha");
            const position = 3;
            appState.game.cycles[0].addCorrectBuzz(
                {
                    player,
                    position,
                    points: 10,
                    isLastWord: false,
                },
                0,
                appState.game.gameFormat,
                0,
                3
            );

            // Make sure the second buzz isn't recorded
            appState.game.cycles[1].addWrongBuzz(
                {
                    player,
                    position,
                    points: -5,
                    isLastWord: false,
                },
                1,
                gameFormat
            );

            await verifyExportToSheetSuccess(appState, (ranges) => verifyCells(ranges, position));
        };

        it("Only played cycles written (Lifsheets)", async () => {
            await onlyPlayedCyclesWrittenTest(SheetType.Lifsheets, (ranges, position) => {
                verifyCell(ranges, "B8", 10);
                verifyCell(ranges, "AJ8", position);

                expect(ranges.find((range) => range.range != undefined && range.range.indexOf("B9") >= 0)).to.be
                    .undefined;
            });
        });
        it("Only played cycles written (TJSheets)", async () => {
            await onlyPlayedCyclesWrittenTest(SheetType.TJSheets, (ranges) => {
                verifyCell(ranges, "C4", 10);

                expect(ranges.find((range) => range.range != undefined && range.range.indexOf("C5") >= 0)).to.be
                    .undefined;
            });
        });
        it("Only played cycles written (UCSDSheets)", async () => {
            await onlyPlayedCyclesWrittenTest(SheetType.UCSDSheets, (ranges) => {
                verifyCell(ranges, "C4", 10);

                expect(ranges.find((range) => range.range != undefined && range.range.indexOf("C5") >= 0)).to.be
                    .undefined;
            });
        });

        it("Filled in sheet gets prompted", async () => {
            const appState: AppState = createAppStateForExport();

            let updateCount = 0;
            const mockSheetsApi: ISheetsApi = createMockApi({
                batchGet: () =>
                    Promise.resolve<ISheetsBatchGetResponse>({
                        success: true,
                        valueRanges: [
                            {
                                values: [["A"]],
                            },
                        ],
                    }),
                batchUpdate: () => {
                    updateCount++;
                    return Promise.resolve({ isError: false, status: "" });
                },
            });

            await Sheets.exportToSheet(appState, mockSheetsApi);

            expect(appState.uiState.sheetsState.exportState).to.equal(ExportState.OverwritePrompt);
            expect(updateCount).to.equal(0);
        });
        it("Export after prompt check succeeds", async () => {
            const appState: AppState = createAppStateForExport();

            let getCount = 0;
            const mockSheetsApi: ISheetsApi = createMockApi({
                batchGet: () => {
                    getCount++;
                    return Promise.resolve<ISheetsBatchGetResponse>({
                        success: true,
                        valueRanges: [
                            {
                                values: [["A"]],
                            },
                        ],
                    });
                },
            });

            appState.uiState.sheetsState.setExportStatus({ isError: false, status: "" }, ExportState.OverwritePrompt);

            await Sheets.exportToSheet(appState, mockSheetsApi);

            expect(appState.uiState.sheetsState).to.exist;
            expect(appState.uiState.sheetsState.exportStatus?.isError).to.exist;
            expect(appState.uiState.sheetsState.exportStatus?.isError).to.be.false;
            expect(appState.uiState.sheetsState.exportState).to.equal(ExportState.Success);
            expect(getCount).to.equal(0);
        });
        it("Empty value in sheet skips prompt and completes export", async () => {
            const appState: AppState = createAppStateForExport();

            let getCount = 0;
            const mockSheetsApi: ISheetsApi = createMockApi({
                batchGet: () => {
                    getCount++;
                    return Promise.resolve<ISheetsBatchGetResponse>({
                        success: true,
                        valueRanges: [],
                    });
                },
            });

            await Sheets.exportToSheet(appState, mockSheetsApi);

            expect(appState.uiState.sheetsState).to.exist;
            expect(appState.uiState.sheetsState.exportStatus?.isError).to.exist;
            expect(appState.uiState.sheetsState.exportStatus?.isError).to.be.false;
            expect(appState.uiState.sheetsState.exportState).to.equal(ExportState.Success);
            expect(getCount).to.equal(1);
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
        const loadRostersSucceedsTest = async (
            sheetType: SheetType,
            expectedPendingGameType: PendingGameType,
            cells: string[][],
            verifyPlayers: (pendingNewGame: IPendingFromSheetsNewGame, playerNamesFromRosters: string[]) => void
        ) => {
            const appState: AppState = createAppStateForRosters(sheetType, expectedPendingGameType);

            const mockSheetsApi: ISheetsApi = createMockApi({
                get: () =>
                    Promise.resolve<ISheetsGetResponse>({
                        success: true,
                        valueRange: {
                            values: cells,
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
            if (appState.uiState.pendingNewGame.type === PendingGameType.Manual) {
                assert.fail(
                    `PendingNewGame type should've been Lifsheets, but was ${appState.uiState.pendingNewGame?.type}`
                );
            }

            expect(appState.uiState.pendingNewGame.type).to.equal(expectedPendingGameType);

            const pendingNewGame: IPendingNewGame = appState.uiState.pendingNewGame;
            const playerNamesFromRosters: string[] = (pendingNewGame.playersFromRosters ?? []).map(
                (player) => player.name
            );

            // Make sure all the players are loaded, and that the defaults are set
            expect(playerNamesFromRosters).to.exist;
            expect(playerNamesFromRosters.length).to.not.equal(0);
            expect(appState.uiState.sheetsState.rosterLoadState).to.equal(LoadingState.Loaded);
            verifyPlayers(pendingNewGame, playerNamesFromRosters);
        };

        it("Success (Lifsheets)", async () => {
            const firstRow: string[] = ["Alpha", "Alice", "Andrew", "Ana"];
            const secondRow: string[] = ["Beta", "Bob", "Barbara"];
            const thirdRow: string[] = ["Gamma", "Gabe", "Gina"];

            await loadRostersSucceedsTest(
                SheetType.Lifsheets,
                PendingGameType.Lifsheets,
                [firstRow, secondRow, thirdRow],
                (pendingNewGame, playerNamesFromRosters) => {
                    for (const name of firstRow.slice(1).concat(secondRow.slice(1)).concat(thirdRow.slice(1))) {
                        expect(playerNamesFromRosters).to.contain(name);
                    }

                    expect(
                        pendingNewGame.firstTeamPlayersFromRosters?.map((player) => player.name) ?? []
                    ).to.deep.equal(firstRow.slice(1));
                    expect(
                        pendingNewGame.secondTeamPlayersFromRosters?.map((player) => player.name) ?? []
                    ).to.deep.equal(secondRow.slice(1));
                }
            );
        });
        it("Success (TJSheets)", async () => {
            const teamNames: string[] = ["Alpha", "Beta", "Gamma"];
            const firstTeamPlayers: string[] = ["Alice", "Andrew", "Ana"];
            const secondTeamPlayers: string[] = ["Bob", "Barbara"];
            const thirdTeamPlayers: string[] = ["Gabe", "Gina"];

            await loadRostersSucceedsTest(
                SheetType.TJSheets,
                PendingGameType.TJSheets,
                [
                    teamNames,
                    [firstTeamPlayers[0], secondTeamPlayers[0], thirdTeamPlayers[0]],
                    [firstTeamPlayers[1], secondTeamPlayers[1], thirdTeamPlayers[1]],
                    [firstTeamPlayers[2]],
                ],
                (pendingNewGame, playerNamesFromRosters) => {
                    for (const name of firstTeamPlayers.concat(secondTeamPlayers).concat(thirdTeamPlayers)) {
                        expect(playerNamesFromRosters).to.contain(name);
                    }

                    expect(
                        pendingNewGame.firstTeamPlayersFromRosters?.map((player) => player.name) ?? []
                    ).to.deep.equal(firstTeamPlayers);
                    expect(
                        pendingNewGame.secondTeamPlayersFromRosters?.map((player) => player.name) ?? []
                    ).to.deep.equal(secondTeamPlayers);
                }
            );
        });
        it("Success (UCSDSheets)", async () => {
            const firstRow: string[] = ["Alpha", "Alice", "Andrew", "Ana"];
            const secondRow: string[] = ["Beta", "Bob", "Barbara"];
            const thirdRow: string[] = ["Gamma", "Gabe", "Gina"];

            await loadRostersSucceedsTest(
                SheetType.UCSDSheets,
                PendingGameType.UCSDSheets,
                [firstRow, secondRow, thirdRow],
                (pendingNewGame, playerNamesFromRosters) => {
                    for (const name of firstRow.slice(1).concat(secondRow.slice(1)).concat(thirdRow.slice(1))) {
                        expect(playerNamesFromRosters).to.contain(name);
                    }

                    expect(
                        pendingNewGame.firstTeamPlayersFromRosters?.map((player) => player.name) ?? []
                    ).to.deep.equal(firstRow.slice(1));
                    expect(
                        pendingNewGame.secondTeamPlayersFromRosters?.map((player) => player.name) ?? []
                    ).to.deep.equal(secondRow.slice(1));
                }
            );
        });

        const zeroTeamsTest = async (sheetsType: SheetType) => {
            const appState: AppState = createAppStateForRosters(sheetsType);
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
        };

        it("Zero teams (Lifsheets)", async () => {
            await zeroTeamsTest(SheetType.Lifsheets);
        });
        it("Zero teams (TJSheets)", async () => {
            // For this specific test,
            await zeroTeamsTest(SheetType.TJSheets);
        });
        it("Zero teams (UCSDSheets)", async () => {
            await zeroTeamsTest(SheetType.UCSDSheets);
        });

        const oneTeamTest = async (sheetType: SheetType, rows: string[][]) => {
            const appState: AppState = createAppStateForRosters(sheetType);

            const mockSheetsApi: ISheetsApi = createMockApi({
                get: () =>
                    Promise.resolve<ISheetsGetResponse>({
                        success: true,
                        valueRange: {
                            values: rows,
                        },
                    }),
            });

            await verifyLoadRostersError(appState, mockSheetsApi, "Not enough teams. Only found 1 team(s).");
        };

        it("Only one team (Lifsheets)", async () => {
            await oneTeamTest(SheetType.Lifsheets, [["Alpha", "Alice", "Andrew", "Ana"]]);
        });
        it("Only one team (TJSheets)", async () => {
            await oneTeamTest(SheetType.TJSheets, [["Alpha"], ["Alice"], ["Andrew"], ["Ana"]]);
        });
        it("Only one team (UCSDSheets)", async () => {
            await oneTeamTest(SheetType.UCSDSheets, [["Alpha", "Alice", "Andrew", "Ana"]]);
        });

        const noPlayersOnTeamTest = async (sheetType: SheetType, noPlayerTeam: string, rows: string[][]) => {
            const appState: AppState = createAppStateForRosters(sheetType);

            const mockSheetsApi: ISheetsApi = createMockApi({
                get: () =>
                    Promise.resolve<ISheetsGetResponse>({
                        success: true,
                        valueRange: {
                            values: rows,
                        },
                    }),
            });

            await verifyLoadRostersError(
                appState,
                mockSheetsApi,
                `Team "${noPlayerTeam}" doesn't have any players. Check the roster sheet to make sure at least 1 player is on each team.`
            );
        };

        it("No players on a team (Lifsheets)", async () => {
            const teamOnlyRow = ["Gamma"];
            const rows: string[][] = [
                ["Alpha", "Alice", "Andrew", "Ana"],
                ["Beta", "Bob"],
                teamOnlyRow,
                ["Delta", "Diana"],
            ];

            await noPlayersOnTeamTest(SheetType.Lifsheets, teamOnlyRow[0], rows);
        });
        it("No players on a team (TJSheets)", async () => {
            const rows: string[][] = [
                ["Alpha", "Beta", "Gamma", "Delta"],
                ["Alice", "Bob", "", "Diana"],
                ["Andrew"],
                ["Ana"],
            ];

            await noPlayersOnTeamTest(SheetType.TJSheets, "Gamma", rows);
        });
        it("No players on a team (UCSDSheets)", async () => {
            const teamOnlyRow = ["Gamma"];
            const rows: string[][] = [
                ["Alpha", "Alice", "Andrew", "Ana"],
                ["Beta", "Bob"],
                teamOnlyRow,
                ["Delta", "Diana"],
            ];

            await noPlayersOnTeamTest(SheetType.UCSDSheets, teamOnlyRow[0], rows);
        });

        const controlSheetTest = async (sheetType: SheetType, rows: string[][]) => {
            const appState: AppState = createAppStateForRosters(sheetType);

            const mockSheetsApi: ISheetsApi = createMockApi({
                get: () =>
                    Promise.resolve<ISheetsGetResponse>({
                        success: true,
                        valueRange: {
                            values: rows,
                        },
                    }),
            });

            await verifyLoadRostersError(
                appState,
                mockSheetsApi,
                "Roster spreadsheet is from the control sheet instead of the reader's scoresheet. Please paste the URL to your scoresheet."
            );
        };

        it("Control sheet (Lifsheets)", async () => {
            await controlSheetTest(SheetType.Lifsheets, [
                ["1", "", "Alpha", "Alice", "Andrew", "Ana"],
                ["2", "", "Beta", "Bob"],
            ]);
        });
        it("Control sheet (UCSDSheets)", async () => {
            await controlSheetTest(SheetType.UCSDSheets, [
                ["Team", "Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6", "Division"],
                ["Alpha", "Alice", "Andrew", "Ana"],
                ["Beta", "Bob"],
            ]);
        });
        // This test doesn't exist for TJ Sheets, since the worksheet we look for is different than the one we request,
        // so the call fails before we do the control sheet check

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
