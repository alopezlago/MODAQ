import { assertNever } from "@fluentui/react";

import * as PlayerToColumnMap from "./PlayerToColumnMap";
import { UIState } from "src/state/UIState";
import { ExportState, LoadingState, SheetType } from "src/state/SheetState";
import { GameState } from "src/state/GameState";
import { AppState } from "src/state/AppState";
import { SheetsApi } from "src/sheets/SheetsApi";
import { ISheetsApi, ISheetsBatchGetResponse, ISheetsGetResponse } from "./ISheetsApi";
import { IStatus } from "src/IStatus";
import { IRoster, ISheetsGenerator } from "./ISheetsGenerator";
import { LifsheetsGenerator } from "./LifsheetsGenerator";
import { TJSheetsGenerator } from "./TJSheetsGenerator";
import { UCSDSheetsGenerator } from "./UCSDSheetsGenerator";

// TODO:
// - Socket integration! Can be very tricky because of how the cycle/phases are backed differently
//     - Need to send a message when a tossup is scored. Need to send one when a bonus is scored, but it shouldn't be
//       sent until "Next Question" is clicked.
//         - Alternatively, we should have a different Game implementation, and we should move it to an interface (IGame).
//         - Ones that use advanced stats would support phases that have advanced stats, and would allow us to jump to
//           any phase.
// - Create Format. Should include: power marker (e.g. (*)), neg value, power value, bouncebacks (when supported)
//     - May be easier to support some basic things, like regulation tossup count. Could block Next -> if it's past that
//         - Means we have to calculate how many TUs were read for the Sheets export
//     - Could make Format something we only change in Options, but it should be part of the New Game flow. May require
//       converting it to a wizard (add packet, add teams, choose format)
//       - Format could also be a dropdown, with one option being "Custom..." that would open a popup. But we want to
//         show what the format is too... could maybe do with collapsible panes.
// Ideally, next steps would be to have a autorun or reaction when cycles change, so we can update the scoresheet.
// But to keep things simple at first, can just export (adding players > 6 could cause problems, as could multiple tiebreakers)

const sheetsPrefix = "https://docs.google.com/spreadsheets/d/";
export async function exportToSheet(appState: AppState, sheetsApi: ISheetsApi = SheetsApi): Promise<void> {
    const game: GameState = appState.game;
    const uiState: UIState = appState.uiState;

    // Don't change the state to CheckingOverwrite if we were just asking about it
    uiState.sheetsState.setExportStatus(
        {
            isError: false,
            status: "Signing in to Sheets",
        },
        uiState.sheetsState.exportState !== ExportState.OverwritePrompt ? ExportState.CheckingOvewrite : undefined
    );

    await sheetsApi.initializeIfNeeded(uiState);

    const sheetsGenerator: ISheetsGenerator = getSheetsGenerator(appState.uiState);

    if (uiState.sheetsState.exportState == undefined) {
        // Cancelled, leave early
        return;
    } else if (game.teamNames.length > 2) {
        uiState.sheetsState.setExportStatus(
            {
                isError: true,
                status: "Export not allowed with more than two teams",
            },
            ExportState.Error
        );
        return;
    } else if (game.cycles.length > sheetsGenerator.cyclesLimit) {
        uiState.sheetsState.setExportStatus(
            {
                isError: true,
                status: `Export not allowed with more than ${sheetsGenerator.cyclesLimit} rounds (not enough rows)`,
            },
            ExportState.Error
        );
        return;
    }

    const sheetName = sheetsGenerator.getSheetName(uiState.sheetsState.roundNumber ?? 1);

    if (uiState.sheetsState.exportState !== ExportState.OverwritePrompt) {
        uiState.sheetsState.setExportStatus({
            isError: false,
            status: "Signed into Sheets. Checking if scoresheet already filled in...",
        });

        let values: gapi.client.sheets.ValueRange[];
        try {
            const response: ISheetsBatchGetResponse = await sheetsApi.batchGet(
                uiState,
                sheetsGenerator.overwriteCheckRanges.map((range) => `'${sheetName}'!${range}`)
            );
            if (!response.success) {
                uiState.sheetsState.setExportStatus(
                    {
                        isError: true,
                        status: `Check failed. Error from Sheets API: ${response.errorMessage}`,
                    },
                    ExportState.Error
                );

                return;
            }

            values = response.valueRanges;
        } catch (e) {
            uiState.sheetsState.setExportStatus(
                {
                    isError: true,
                    status: `Check failed. Error: ${e.message}`,
                },
                ExportState.Error
            );
            return;
        }

        if (uiState.sheetsState.exportState == undefined) {
            // Cancelled, leave early
            return;
        }

        if (
            values != undefined &&
            values.some(
                (valueRange) =>
                    valueRange?.values != undefined &&
                    valueRange.values.some((value) => value != undefined && value.length > 0)
            )
        ) {
            uiState.sheetsState.setExportStatus(
                {
                    isError: false,
                    status: `The round you are scoring (${sheetName}) already has values in it. Are you sure you want to ovewrite this scoresheet?`,
                },
                ExportState.OverwritePrompt
            );
            return;
        }
    }

    if (uiState.sheetsState.exportState == undefined) {
        // Cancelled
        return;
    }

    uiState.sheetsState.setExportStatus(
        {
            isError: false,
            status: "Exporting...",
        },
        ExportState.Exporting
    );

    // TODO: Would be more efficient if we did a group-by operation, but the number of teams should be small
    // TODO: This should count it by starters + subs, not just players
    for (const teamName of game.teamNames) {
        if (game.players.filter((player) => player.teamName === teamName).length > sheetsGenerator.playerPerTeamLimit) {
            uiState.sheetsState.setExportStatus(
                {
                    isError: true,
                    status: "Export not allowed with more than six players per a team",
                },
                ExportState.Error
            );
            return;
        }
    }
    const firstTeamName: string = game.teamNames[0];
    let valueRanges: gapi.client.sheets.ValueRange[] = sheetsGenerator.getValuesForTeams(game.teamNames, sheetName);

    // We need to clear bonuses before other values (if clear didn't take care of it)
    valueRanges = valueRanges.concat(sheetsGenerator.getValuesForBonusClear(sheetName));

    // Build a mapping between players and columns
    let firstTeamColumn = sheetsGenerator.playerInitialColumns[0];
    let secondTeamColumn = sheetsGenerator.playerInitialColumns[1];
    const playerToColumnMapping: PlayerToColumnMap.IPlayerToColumnMap = PlayerToColumnMap.createPlayerToColumnMap();
    for (const player of game.players) {
        const isOnFirstTeam: boolean = player.teamName === firstTeamName;

        let column: string;
        if (isOnFirstTeam) {
            column = firstTeamColumn;
            firstTeamColumn = String.fromCharCode(firstTeamColumn.charCodeAt(0) + 1);
        } else {
            column = secondTeamColumn;
            secondTeamColumn = String.fromCharCode(secondTeamColumn.charCodeAt(0) + 1);
        }

        playerToColumnMapping.set(player, column);
        valueRanges.push({
            range: `'${sheetName}'!${column}${sheetsGenerator.playerRow}`,
            values: [[player.name]],
        });
    }

    // Players that aren't starters need to have Out in the first column
    // See https://minkowski.space/quizbowl/manuals/scorekeeping/moderator.html#substitutions
    valueRanges = valueRanges.concat(
        sheetsGenerator.getValuesForStartingLineups(game.players, playerToColumnMapping, sheetName)
    );

    let row = sheetsGenerator.firstCycleRow;
    for (const cycle of game.cycles) {
        // We must do substitutions first, since we may have to clear an Out value if a player was subbed in on the
        // first tossup
        if (cycle.subs) {
            for (const sub of cycle.subs) {
                valueRanges = valueRanges.concat(
                    sheetsGenerator.getValuesForSubs(sub, playerToColumnMapping, sheetName, row)
                );
            }
        }

        if (cycle.playerLeaves) {
            for (const leave of cycle.playerLeaves) {
                valueRanges = valueRanges.concat(
                    sheetsGenerator.getValuesForPlayerLeaves(leave, playerToColumnMapping, sheetName, row)
                );
            }
        }

        if (cycle.playerJoins) {
            for (const joins of cycle.playerJoins) {
                valueRanges = valueRanges.concat(
                    sheetsGenerator.getValuesForPlayerJoins(joins, playerToColumnMapping, sheetName, row)
                );
            }
        }

        const buzzPoints: number[] = [];

        if (cycle.wrongBuzzes) {
            for (const buzz of cycle.wrongBuzzes.filter((b) => b.marker.points < 0)) {
                valueRanges = valueRanges.concat(
                    sheetsGenerator.getValuesForNeg(buzz, playerToColumnMapping, sheetName, row)
                );

                const negColumn: string | undefined = playerToColumnMapping.get(buzz.marker.player);
                if (negColumn != undefined) {
                    buzzPoints.push(buzz.marker.position);
                }
            }
        }

        if (cycle.correctBuzz) {
            valueRanges = valueRanges.concat(
                sheetsGenerator.getValuesForCorrectBuzz(cycle.correctBuzz, playerToColumnMapping, sheetName, row)
            );

            const correctColumn: string | undefined = playerToColumnMapping.get(cycle.correctBuzz.marker.player);
            if (correctColumn != undefined) {
                buzzPoints.push(cycle.correctBuzz.marker.position);
            }

            if (cycle.bonusAnswer) {
                valueRanges = valueRanges.concat(
                    sheetsGenerator.getValuesForBonusAnswer(cycle.bonusAnswer, game.teamNames, sheetName, row)
                );
            }
        } else {
            valueRanges = valueRanges.concat(sheetsGenerator.getValuesForDeadQuestion(sheetName, row));
        }

        if (cycle.tossupProtests) {
            valueRanges = valueRanges.concat(
                sheetsGenerator.getValuesForTossupProtests(cycle.tossupProtests, game.teamNames, sheetName, row)
            );
        }

        if (cycle.bonusProtests) {
            valueRanges = valueRanges.concat(
                sheetsGenerator.getValuesForBonusProtests(cycle.bonusProtests, game.teamNames, sheetName, row)
            );
        }

        // Buzz points are expected to be in ascending order, so sort the list and write them to the columns
        valueRanges = valueRanges.concat(sheetsGenerator.getValuesForBuzzPoints(buzzPoints, sheetName, row));

        row++;
    }
    if (uiState.sheetsState.sheetId == undefined) {
        uiState.sheetsState.setExportStatus(
            {
                isError: true,
                status: "Export requires a sheet ID",
            },
            ExportState.Error
        );
        return;
    }

    // If we need to log the tossups we've heard, log them here
    valueRanges = valueRanges.concat(
        sheetsGenerator.getValuesForTossupsHeard(game.cycles, game.players, playerToColumnMapping, sheetName)
    );

    if (uiState.sheetsState.exportState == undefined) {
        // Cancelled, leave early
        return;
    }

    try {
        // Clear the spreadsheet first, to remove anything we've undone/changed
        const ranges: string[] = sheetsGenerator.getClearRanges(sheetName);

        const clearStatus: IStatus = await sheetsApi.batchClear(uiState, ranges);
        if (clearStatus.isError) {
            uiState.sheetsState.setExportStatus(
                {
                    isError: true,
                    status: `Error from Sheets API clearing the values. Error: ${clearStatus.status}`,
                },
                ExportState.Error
            );
            return;
        }

        uiState.sheetsState.setExportStatus({
            isError: false,
            status: "Export halfway completed...",
        });

        if (uiState.sheetsState.exportState == undefined) {
            // Cancelled, leave early
            return;
        }

        const updateStatus: IStatus = await sheetsApi.batchUpdate(uiState, valueRanges);
        if (updateStatus.isError) {
            uiState.sheetsState.setExportStatus(
                {
                    isError: true,
                    status: `Error from Sheets API writing the values. Error: ${updateStatus.status}`,
                },
                ExportState.Error
            );
            return;
        }

        // clear status
        uiState.sheetsState.setExportStatus(
            {
                isError: false,
                status: "Export completed",
            },
            ExportState.Success
        );
    } catch (e) {
        uiState.sheetsState?.setExportStatus(
            {
                isError: true,
                status: `Export failed. Error: ${e.message}`,
            },
            ExportState.Error
        );
    }
}

// TODO: Move to helper method, or place where we don't make API calls
export function getSheetsId(url: string | undefined): string | undefined {
    // URLs look like https://docs.google.com/spreadsheets/d/1ZWEIXEcDPpuYhMOqy7j8uKloKJ7xrMlx8Q8y4UCbjZA/edit#gid=17040017
    if (url == undefined) {
        return;
    }

    url = url.trim();
    if (!url.startsWith(sheetsPrefix)) {
        return undefined;
    }

    const nextSlash: number = url.indexOf("/", sheetsPrefix.length);
    const sheetsId: string = url.substring(sheetsPrefix.length, nextSlash === -1 ? undefined : nextSlash);

    return sheetsId.trim();
}

export async function loadRosters(appState: AppState, sheetsApi: ISheetsApi = SheetsApi): Promise<void> {
    // This should load the teams and rosters from Lifsheets
    // UIState needs something like SheetsState, or maybe we need to have two copies of it?
    // TeamName is in C2-C...
    // Player1-Player6 is in D2-I2 for the first team, D3-I3 for the second, etc.
    const uiState: UIState = appState.uiState;

    uiState.sheetsState.setRosterLoadStatus(
        {
            isError: false,
            status: "Signing in to Sheets",
        },
        LoadingState.Loading
    );

    await sheetsApi.initializeIfNeeded(uiState);

    const spreadsheetId: string | undefined = uiState.sheetsState.sheetId;
    if (spreadsheetId == undefined) {
        return;
    }

    uiState.sheetsState.setRosterLoadStatus(
        {
            isError: false,
            status: `Loading...`,
        },
        LoadingState.Loading
    );

    const sheetsGenerator: ISheetsGenerator = getSheetsGenerator(appState.uiState);

    let values: gapi.client.sheets.ValueRange;
    try {
        const response: ISheetsGetResponse = await sheetsApi.get(uiState, sheetsGenerator.rostersRange);
        if (!response.success) {
            uiState.sheetsState.setRosterLoadStatus(
                {
                    isError: true,
                    status: `Load failed. Error from Sheets API: ${response.errorMessage}`,
                },
                LoadingState.Error
            );

            return;
        }

        values = response.valueRange;
    } catch (e) {
        uiState.sheetsState.setRosterLoadStatus(
            {
                isError: true,
                status: `Load failed. Error: ${e.message}`,
            },
            LoadingState.Error
        );
        return;
    }

    if (!values.values) {
        uiState.sheetsState.setRosterLoadStatus(
            {
                isError: true,
                status: `No teams found during loading.`,
            },
            LoadingState.Error
        );
        return;
    }

    if (sheetsGenerator.isControlSheet(values)) {
        uiState.sheetsState.setRosterLoadStatus(
            {
                isError: true,
                status:
                    "Roster spreadsheet is from the control sheet instead of the reader's scoresheet. Please paste the URL to your scoresheet.",
            },
            LoadingState.Error
        );
        return;
    }

    const rosters: IRoster | undefined = sheetsGenerator.getRosters(values);
    if (rosters == undefined || rosters.teamNames == undefined) {
        uiState.sheetsState.setRosterLoadStatus(
            {
                isError: true,
                status: `Couldn't parse the rosters spreadsheet`,
            },
            LoadingState.Error
        );
        return;
    } else if (rosters.teamNames.length <= 1) {
        uiState.sheetsState.setRosterLoadStatus(
            {
                isError: true,
                status: `Not enough teams. Only found ${rosters.teamNames.length} team(s).`,
            },
            LoadingState.Error
        );
        return;
    }

    const playerTeams: Set<string> = new Set<string>();
    for (const player of rosters.players) {
        playerTeams.add(player.teamName);
    }

    for (const teamName of rosters.teamNames) {
        if (!playerTeams.has(teamName)) {
            uiState.sheetsState.setRosterLoadStatus(
                {
                    isError: true,
                    status: `Team "${teamName}" doesn't have any players. Check the roster sheet to make sure at least 1 player is on each team.`,
                },
                LoadingState.Error
            );
            return;
        }
    }

    uiState.sheetsState.setRosterLoadStatus(
        {
            isError: false,
            status: `Load succeeded`,
        },
        LoadingState.Loaded
    );

    uiState.setPendingNewGameRosters(rosters.players);

    const firstTeamName: string = rosters.teamNames[0];
    const secondTeamName: string = rosters.teamNames[1];
    uiState.setPendingNewGameFirstTeamPlayers(rosters.players.filter((player) => player.teamName === firstTeamName));
    uiState.setPendingNewGameSecondTeamPlayers(rosters.players.filter((player) => player.teamName === secondTeamName));

    return;
}

function getSheetsGenerator(uiState: UIState): ISheetsGenerator {
    switch (uiState.sheetsState.sheetType) {
        // Default to Lifsheets if undefined
        case undefined:
        case SheetType.Lifsheets:
            return LifsheetsGenerator;
        case SheetType.TJSheets:
            return TJSheetsGenerator;
        case SheetType.UCSDSheets:
            return UCSDSheetsGenerator;
        default:
            assertNever(uiState.sheetsState.sheetType);
    }
}
