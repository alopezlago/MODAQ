import { UIState } from "src/state/UIState";
import { ExportState, LoadingState } from "src/state/SheetState";
import { GameState } from "src/state/GameState";
import { IBonusProtestEvent } from "src/state/Events";
import { IPlayer } from "src/state/TeamState";

// TODO:
// - Refactor so that game/UI state travel in an appState prop
// - Refactor dialogs so there's a ModalDialogManager, which can handle rendering dialogs. Could be stacked, though maybe
//   it makes sense to just render modals?
// - UI for picking teams from the sheet.
//     - We need to make "+ New Game" a split button; one for "manual teams" and one for "from OphirStats"
//     - From OphirStats should have an input field for the URL and a button to load the teams/players
//         - If we can't connect/whatever, we should show an error message
//         - If we connect, then show the two teams and the list of players
//         - We need to hook this up to the state
// - Split the logic for creating ranges from the logic for export. Maybe have some IGoogleSheetsApi that can sign in
//   and send the clear/update requests, so that the rest of it is testable
//    - Alternatively, split this into Sheet.ts and SheetsApi.ts, and have the UI call SheetsApi, which calls Sheet.ts
// - Socket integration! Can be very tricky because of how the cycle/phases are backed differently
//     - Need to send a message when a tossup is scored. Need to send one when a bonus is scored, but it shouldn't be
//       sent until "Next Question" is clicked.
//         - Alternatively, we should have a different Game implementation, and we should move it to an interface (IGame).
//         - Ones that use advanced stats would support phases that have advanced stats, and would allow us to jump to
//           any phase.

// Ideally, next steps would be to have a autorun or reaction when cycles change, so we can update the scoresheet.
// But to keep things simple at first, can just export (adding players > 6 could cause problems, as could multiple tiebreakers)

const firstCycleRow = 8;

export async function exportToSheet(game: GameState, uiState: UIState): Promise<void> {
    uiState.sheetsState.setExportStatus(
        {
            isError: false,
            status: "Signing in to Sheets",
        },
        ExportState.Exporting
    );

    await initalizeIfNeeded(uiState);

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

                const outPlayerColumn: string | undefined = playerToColumnMapping.get(getPlayerKey(sub.inPlayer));
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
        buzzPoints.sort();
        for (let i = 0; i < 2 && i < buzzPoints.length; i++) {
            const column: string = i === 0 ? "AJ" : "AK";
            valueRanges.push({
                range: `'${sheetName}'!${column}${row}`,
                values: [[buzzPoints[i]]],
            });
        }

        row++;
    }

    // TODO: This should always come from sheetId, and should not be null
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

    const spreadsheetId: string = uiState.sheetsState.sheetId;

    try {
        // Clear the spreadsheet first, to remove anything we've undone/changed
        await gapi.client.sheets.spreadsheets.values.batchClear({
            spreadsheetId,
            resource: {
                ranges: [
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
                ],
            },
        });

        uiState.sheetsState.setExportStatus({
            isError: false,
            status: "Export halfway completed...",
        });

        await gapi.client.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource: {
                data: valueRanges,
                valueInputOption: "RAW",
            },
        });

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

async function initalizeIfNeeded(uiState: UIState): Promise<void> {
    if (
        uiState.sheetsState.apiInitialized === LoadingState.Loading ||
        uiState.sheetsState.apiInitialized === LoadingState.Loaded
    ) {
        return;
    }

    // Bit of a hacky wait to wait until the callback is done
    uiState.setSheetsApiInitialized(LoadingState.Loading);
    const promise: Promise<void> = new Promise<void>((resolve, reject) => {
        gapi.load("client:auth2", async () => {
            try {
                await gapi.client.init({
                    // TODO: See if we can get this injected by webpack somehow
                    apiKey: "AIzaSyBvt62emmPzKNegGgCjkeZ8n0Iqq7w6IhM",
                    clientId: "1038902414768-nj056sbrbe0oshavft2uq9et6tvbu2d5.apps.googleusercontent.com",
                    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
                    scope: "https://www.googleapis.com/auth/spreadsheets",
                });

                const authInstance: gapi.auth2.GoogleAuth = gapi.auth2.getAuthInstance();
                const isSignedIn: boolean = authInstance.isSignedIn.get();
                if (!isSignedIn) {
                    const user: gapi.auth2.GoogleUser = await authInstance.signIn();
                    console.log("Logged in with user.");
                    console.log(user);
                }

                uiState.setSheetsApiInitialized(LoadingState.Loaded);
                resolve();
            } catch (error) {
                console.log("Couldn't initialize Sheets API");
                console.log(error);
                uiState.setSheetsApiInitialized(LoadingState.Error);
                reject(error);
            }
        });
    });

    await promise;
}

function getPlayerKey(player: IPlayer): string {
    return `${player.teamName.replace(/;/g, ";;")};${player.name}`;
}
