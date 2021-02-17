import { UIState } from "src/state/UIState";
import { ExportState, LoadingState } from "src/state/SheetState";
import { GameState } from "src/state/GameState";
import { IBonusProtestEvent } from "src/state/Events";
import { IPlayer, Player } from "src/state/TeamState";
import { AppState } from "src/state/AppState";
import { SheetsApi } from "src/sheets/SheetsApi";
import { ISheetsApi, ISheetsGetResponse } from "./ISheetsApi";
import { IStatus } from "src/IStatus";

// TODO:
// - Socket integration! Can be very tricky because of how the cycle/phases are backed differently
//     - Need to send a message when a tossup is scored. Need to send one when a bonus is scored, but it shouldn't be
//       sent until "Next Question" is clicked.
//         - Alternatively, we should have a different Game implementation, and we should move it to an interface (IGame).
//         - Ones that use advanced stats would support phases that have advanced stats, and would allow us to jump to
//           any phase.

// Ideally, next steps would be to have a autorun or reaction when cycles change, so we can update the scoresheet.
// But to keep things simple at first, can just export (adding players > 6 could cause problems, as could multiple tiebreakers)

const sheetsPrefix = "https://docs.google.com/spreadsheets/d/";
const firstCycleRow = 8;

export async function exportToSheet(appState: AppState, sheetsApi: ISheetsApi = SheetsApi): Promise<void> {
    const game: GameState = appState.game;
    const uiState: UIState = appState.uiState;

    uiState.sheetsState.setExportStatus(
        {
            isError: false,
            status: "Signing in to Sheets",
        },
        ExportState.Exporting
    );

    await sheetsApi.initializeIfNeeded(uiState);

    if (game.teamNames.length > 2) {
        uiState.sheetsState.setExportStatus(
            {
                isError: true,
                status: "Export not allowed with more than two teams",
            },
            ExportState.Error
        );
        return;
    } else if (game.cycles.length > 21) {
        uiState.sheetsState.setExportStatus(
            {
                isError: true,
                status: "Export not allowed with more than 21 rounds (not enough rows)",
            },
            ExportState.Error
        );
        return;
    }

    uiState.sheetsState.setExportStatus({
        isError: false,
        status: "Signed into Sheets. Exporting...",
    });

    // TODO: Would be more efficient if we did a group-by operation, but the number of teams should be small
    // TODO: This should count it by starters + subs, not just players
    for (const teamName of game.teamNames) {
        if (game.players.filter((player) => player.teamName === teamName).length > 6) {
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

    const sheetName = `Round ${uiState.sheetsState.roundNumber ?? 1}`;
    const firstTeamName: string = game.teamNames[0];

    const valueRanges: gapi.client.sheets.ValueRange[] = [
        {
            range: `'${sheetName}'!C5`,
            values: [[game.teamNames[0]]],
        },
        {
            range: `'${sheetName}'!S5`,
            values: [[game.teamNames[1]]],
        },
    ];

    // Build a mapping between players and columns
    let firstTeamColumn = "B";
    let secondTeamColumn = "R";
    const playerToColumnMapping: Map<string, string> = new Map();
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

        playerToColumnMapping.set(getPlayerKey(player), column);
        valueRanges.push({
            range: `'${sheetName}'!${column}7`,
            values: [[player.name]],
        });
    }

    // Players that aren't starters need to have Out in the first column
    // See https://minkowski.space/quizbowl/manuals/scorekeeping/moderator.html#substitutions
    for (const player of game.players.filter((p) => !p.isStarter)) {
        const playerColumn: string | undefined = playerToColumnMapping.get(getPlayerKey(player));
        if (playerColumn != undefined) {
            valueRanges.push({
                range: `'${sheetName}'!${playerColumn}${firstCycleRow}`,
                values: [["Out"]],
            });
        }
    }

    let row = firstCycleRow;
    for (const cycle of game.cycles) {
        // We must do substitutions first, since we may have to clear an Out value if a player was subbed in on the
        // first tossup
        if (cycle.subs) {
            for (const sub of cycle.subs) {
                const inPlayerColumn: string | undefined = playerToColumnMapping.get(getPlayerKey(sub.inPlayer));
                if (inPlayerColumn == undefined) {
                    continue;
                }

                const outPlayerColumn: string | undefined = playerToColumnMapping.get(getPlayerKey(sub.outPlayer));
                if (outPlayerColumn == undefined) {
                    continue;
                }

                // In goes in the previous row, unless they were subbed in on the first tossup, in which case replace Out
                // with blank
                // See https://minkowski.space/quizbowl/manuals/scorekeeping/moderator.html#substitutions
                const inRow: number = row === firstCycleRow ? row : row - 1;
                valueRanges.push(
                    {
                        range: `'${sheetName}'!${inPlayerColumn}${inRow}`,
                        values: [[inRow === firstCycleRow ? "" : "In"]],
                    },
                    {
                        range: `'${sheetName}'!${outPlayerColumn}${row}`,
                        values: [["Out"]],
                    }
                );
            }
        }

        if (cycle.playerLeaves) {
            for (const leave of cycle.playerLeaves) {
                const outPlayerColumn: string | undefined = playerToColumnMapping.get(getPlayerKey(leave.outPlayer));
                if (outPlayerColumn == undefined) {
                    continue;
                }

                valueRanges.push({
                    range: `'${sheetName}'!${outPlayerColumn}${row}`,
                    values: [["Out"]],
                });
            }
        }

        if (cycle.playerJoins) {
            for (const joins of cycle.playerJoins) {
                const inPlayerColumn: string | undefined = playerToColumnMapping.get(getPlayerKey(joins.inPlayer));
                if (inPlayerColumn == undefined) {
                    continue;
                }

                // In goes in the previous row, unless they were subbed in on the first tossup, in which case replace Out
                // with blank
                // See https://minkowski.space/quizbowl/manuals/scorekeeping/moderator.html#substitutions
                const inRow: number = row === firstCycleRow ? row : row - 1;
                valueRanges.push({
                    range: `'${sheetName}'!${inPlayerColumn}${inRow}`,
                    values: [[inRow === firstCycleRow ? "" : "In"]],
                });
            }
        }

        const buzzPoints: number[] = [];

        if (cycle.negBuzz) {
            const negColumn: string | undefined = playerToColumnMapping.get(getPlayerKey(cycle.negBuzz.marker.player));
            if (negColumn != undefined) {
                valueRanges.push({
                    range: `'${sheetName}'!${negColumn}${row}`,
                    values: [[-5]],
                });

                buzzPoints.push(cycle.negBuzz.marker.position);
            }
        }

        if (cycle.correctBuzz) {
            const correctColumn: string | undefined = playerToColumnMapping.get(
                getPlayerKey(cycle.correctBuzz.marker.player)
            );
            if (correctColumn != undefined) {
                valueRanges.push({
                    range: `'${sheetName}'!${correctColumn}${row}`,
                    // TODO: Calculate if this is a power or not
                    values: [[10]],
                });

                buzzPoints.push(cycle.correctBuzz.marker.position);
            }

            if (cycle.bonusAnswer) {
                const bonusColumn: string = cycle.bonusAnswer.receivingTeamName === firstTeamName ? "H" : "X";

                let bonusScore = "";
                for (let i = 0; i < 3; i++) {
                    // TODO: This isn't very efficient, though there are only 3 parts, so it's not too bad
                    bonusScore += cycle.bonusAnswer.correctParts.findIndex((part) => part.index === i) >= 0 ? "1" : "0";
                }

                valueRanges.push({
                    range: `'${sheetName}'!${bonusColumn}${row}`,
                    values: [[bonusScore]],
                });
            }
        }

        if (cycle.tossupProtests) {
            for (const protest of cycle.tossupProtests) {
                const protestColumn: string = protest.teamName === firstTeamName ? "AF" : "AG";
                valueRanges.push({
                    range: `'${sheetName}'!${protestColumn}${row}`,
                    values: [[protest.reason]],
                });
            }
        }

        if (cycle.bonusProtests) {
            const protestReasons: string = cycle.bonusProtests.reduce((state: string, current: IBonusProtestEvent) => {
                return state + "\n" + current.reason;
            }, "");
            valueRanges.push({
                range: `'${sheetName}'!AH${row}`,
                values: [[protestReasons.trim()]],
            });
        }

        // No need to track no penalty buzzes, since OphirStats doesn't track buzz point data for it

        // Buzz points are expected to be in ascending order, so sort the list and write them to the columns
        buzzPoints.sort(compareNumbers);
        for (let i = 0; i < 2 && i < buzzPoints.length; i++) {
            const column: string = i === 0 ? "AJ" : "AK";
            valueRanges.push({
                range: `'${sheetName}'!${column}${row}`,
                values: [[buzzPoints[i]]],
            });
        }

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

    try {
        // Clear the spreadsheet first, to remove anything we've undone/changed
        const ranges: string[] = [
            // Clear team names, then player names + buzzes, and then bonuses
            `'${sheetName}'!C5:C5`,
            `'${sheetName}'!S5:S5`,

            // Clear player names and buzzes plus bonuses
            `'${sheetName}'!B7:G28`,
            `'${sheetName}'!H8:H27`,

            // Clear bonuses
            `'${sheetName}'!R7:W28`,
            `'${sheetName}'!X8:X27`,

            // Clear protests
            `'${sheetName}'!AF8:AH28`,

            // Clear buzz points
            `'${sheetName}'!AJ8:AK28`,
        ];

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

    let values: gapi.client.sheets.ValueRange;
    try {
        const response: ISheetsGetResponse = await sheetsApi.get(uiState, "Rosters!C2:I49");
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
    } else if (values.values.length <= 1) {
        uiState.sheetsState.setRosterLoadStatus(
            {
                isError: true,
                status: `Not enough teams. Only found ${values.values.length} team(s).`,
            },
            LoadingState.Error
        );
        return;
    } else if (values.values.some((range) => range.length <= 1)) {
        uiState.sheetsState.setRosterLoadStatus(
            {
                isError: true,
                status: `Not all teams have players. Check the roster sheet to make sure at least 1 player is on each team.`,
            },
            LoadingState.Error
        );
        return;
    }

    // TODO: Need place for pendingNewGame teams. Can be its own interface, with team name and list of players.
    // Picking the team from the drop down would set the team/players in the pendingNewGame.

    uiState.sheetsState.setRosterLoadStatus(
        {
            isError: false,
            status: `Load succeeded`,
        },
        LoadingState.Loaded
    );

    // Format: array of teams, first element is the team name, other elements are the players
    const teamNames: string[] = values.values.map((row) => row[0]);
    const players: Player[] = values.values
        .map<Player[]>((row) => {
            const teamName: string = row[0];
            return row.slice(1).map((playerName, index) => new Player(playerName, teamName, index < 4));
        })
        .reduce((previous, current) => previous.concat(current));

    uiState.setRostersForPendingNewGame(players);

    const firstTeamName: string = teamNames[0];
    const secondTeamName: string = teamNames[1];
    uiState.setFirstTeamPlayersFromRostersForPendingNewGame(
        players.filter((player) => player.teamName === firstTeamName)
    );
    uiState.setSecondTeamPlayersFromRostersForPendingNewGame(
        players.filter((player) => player.teamName === secondTeamName)
    );

    return;
}

function compareNumbers(left: number, right: number): number {
    return left - right;
}

function getPlayerKey(player: IPlayer): string {
    return `${player.teamName.replace(/;/g, ";;")};${player.name}`;
}
