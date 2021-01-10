import { UIState } from "./UIState";
import { LoadingState } from "./SheetState";
import { GameState } from "./GameState";
import { IPlayer } from "./TeamState";

// TODO:
// We can start with an "Export to Sheet" button that always creates a new sheet
// Later, we should have an Export drop menu. It can export to a new Sheet, an existing Sheet, or just a JSON file with
// the cycles.
// First, write to the sheet

// Ideally, next steps would be to have a autorun or reaction when cycles change, so we can update the scoresheet.
// But to keep things simple at first, can just export (adding players > 8 could cause problems, as could multiple tiebreakers)
// Need to see what the sheet should look like. Alternative is copying the sheet, but requires more permissions

type Sheet = gapi.client.sheets.Spreadsheet;
type SheetsResponse = gapi.client.Response<Sheet>;
type BatchUpdateValuesResponse = gapi.client.Response<gapi.client.sheets.BatchUpdateValuesResponse>;

export async function exportToSheet(game: GameState, uiState: UIState): Promise<void> {
    await initalizeIfNeeded(uiState);

    // https://developers.google.com/sheets/api/guides/create#javascript
    // if (uiState.sheetsState.sheetId == undefined) {
    //// const title = `QBScoresheet_${game.teamNames.join("_")}`;

    // We shouldn't create a sheet, we should ask for a link to the scoresheet, and ask which round it is
    // From there, we can build "Round X" for the scoresheet, and write values to the sheet
    // Since  we're signed in with the readers creds, we don't need a separate service account to write to it

    // Need to specify Sheet, as well as the grid properties
    // //     const createResponse: SheetsResponse = await gapi.client.sheets.spreadsheets.create({
    // //         resource: {
    // //             properties: {
    // //                 title,
    // //             },
    // //             sheets: [
    // //                 {
    // //                     properties: {
    // //                         gridProperties: {
    // //                             columnCount: 52,
    // //                         },
    // //                     },
    // //                 },
    // //             ],
    // //         },
    // //     });

    // //     console.log("Response from creation");
    // //     console.log(createResponse);

    // //     if (
    // //         createResponse.status != undefined &&
    // //         createResponse.status >= 200 &&
    // //         createResponse.status < 300 &&
    // //         createResponse.result.spreadsheetId != undefined
    // //     ) {
    // //         uiState.setSheetsId(createResponse.result.spreadsheetId);
    // //         console.log("New sheet ID: " + uiState.sheetsState.sheetId);
    // //         console.log("URL: " + createResponse.result.spreadsheetUrl);
    // //     }
    // // }

    // https://developers.google.com/sheets/api/guides/values#javascript_3
    // Now create the spreadsheet. Would be easiest if we could just copy over an existing one...

    // // if (uiState.sheetsState.sheetId == undefined) {
    // //     throw Error("SheetsId shouldn't be undefined here");
    // // }
    // Top line

    const valueRanges: gapi.client.sheets.ValueRange[] = [
        {
            range: "'Round 1'!C5:C5",
            values: [[game.teamNames[0]]],
        },
        {
            range: "'Round 1'!S5:S5",
            values: [[game.teamNames[1]]],
        },
    ];

    // TODO: Add validation.
    // - Can only handle 6 players
    // - Can only handle 21 cycles (no bonuses on last one)
    if (game.teamNames.length > 2) {
        return;
    } else if (game.cycles.length > 21) {
        return;
    }

    // Build player<->column mapping, starting at B and R. Can do SpreadsheetColumn math to handle AA
    let firstTeamColumn = "B";
    let secondTeamColumn = "R";
    const playerToColumnMapping: Map<IPlayer, string> = new Map();
    for (const player of game.players) {
        const isOnFirstTeam: boolean = player.teamName === game.teamNames[0];

        // TODO: This should be a SpreadshetColumn, though it's okay here
        let column: string;
        if (isOnFirstTeam) {
            firstTeamColumn = String.fromCharCode(firstTeamColumn.charCodeAt(0) + 1);
            column = firstTeamColumn;
        } else {
            secondTeamColumn = String.fromCharCode(secondTeamColumn.charCodeAt(0) + 1);
            column = secondTeamColumn;
        }

        playerToColumnMapping.set(player, column);
        valueRanges.push({
            range: `'Round 1'!${column}7:${column}7`,
            values: [[player.name]],
        });
    }

    // For each cycle
    // Find negs/wrongs/corrects, find mapping to column, add the ValueRange
    // If there's a bonus, add that too, with the binary format

    // Add buzz points

    // TODO: This should always come from sheetId, and should not be null
    // const spreadsheetId: string = uiState.sheetsState.sheetId ?? "1ZWEIXEcDPpuYhMOqy7j8uKloKJ7xrMlx8Q8y4UCbjZA";
    const spreadsheetId: string = uiState.sheetsState.sheetId ?? "1ZWEIXEcDPpuYhMOqy7j8uKloKJ7xrMlx8Q8y4UCbjZA";
    const firstLineUpdateResponse: BatchUpdateValuesResponse = await gapi.client.sheets.spreadsheets.values.batchUpdate(
        {
            spreadsheetId,
            resource: {
                data: valueRanges,
                valueInputOption: "RAW",
            },
        }
    );

    console.log("Result from first line update");
    console.log(firstLineUpdateResponse);

    // // try {
    // //     const sheet = await gapi.client.sheets.spreadsheets.get({
    // //         // spreadsheetId: "1dtqzA0cxrR6PlI6j1aKBjZu0kK1MLJKEcKF6N8lq19k",
    // //         // spreadsheetId: "1h9Cxj3kNyQDse3uUWLOB8yqTCf8Kmc5DEzKu-UqzVUQ",
    // //         spreadsheetId,
    // //         ranges: "'Round 1'!C5:S5",
    // //     });
    // //     console.log("Sheet from GDoc");
    // //     console.log(sheet);
    // // } catch (error) {
    // //     console.error(error);
    // // }
}

// TODO: Copy an OphirStats sheet (either with a get call, or with the formats + formulas). Challenges are
// - Doesn't support arbitrary # of players
// - Thrown out tossups/bonuses don't have a good place (comments)
// - Multiple protest negs not supported
// - May depend on other spreadsheets to get teams/player names, which we may have to do eventually
// - Pretty large
// - Assumes standard 3-part, 10 point bonuses

// Might be best to do simple one
// Reader name (if we ask for it)
// Round number (or packet name)
// Row with "Team", first team name ... , "Team", second team name
// Row with headers. First team player names, then bonus, bonus points, bonus + tossup, score, Question #, second player names, bonus, bonus points, bonus + tossup, score, buzz indexes, tossup protests
// Just something as a proof of concept. Should really do something like the OphirStats spreadsheet (much nicer presentation)

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
