import { UIState } from "./UIState";
import { LoadingState } from "./SheetState";
import { GameState } from "./GameState";

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
    if (uiState.sheetsState.sheetId == undefined) {
        const title = `QBScoresheet_${game.teamNames.join("_")}`;

        // Need to specify Sheet, as well as the grid properties
        const createResponse: SheetsResponse = await gapi.client.sheets.spreadsheets.create({
            resource: {
                properties: {
                    title,
                },
                sheets: [
                    {
                        properties: {
                            gridProperties: {
                                columnCount: 52,
                            },
                        },
                    },
                ],
            },
        });

        console.log("Response from creation");
        console.log(createResponse);

        if (
            createResponse.status != undefined &&
            createResponse.status >= 200 &&
            createResponse.status < 300 &&
            createResponse.result.spreadsheetId != undefined
        ) {
            uiState.setSheetsId(createResponse.result.spreadsheetId);
            console.log("New sheet ID: " + uiState.sheetsState.sheetId);
            console.log("URL: " + createResponse.result.spreadsheetUrl);
        }
    }

    // https://developers.google.com/sheets/api/guides/values#javascript_3
    // Now create the spreadsheet. Would be easiest if we could just copy over an existing one...

    if (uiState.sheetsState.sheetId == undefined) {
        throw Error("SheetsId shouldn't be undefined here");
    }
    // Top line

    // This fails because AC is beyond grid limits. Can only do 26 columns
    const firstLineData: gapi.client.sheets.ValueRange[] = [
        {
            range: "B5",
            values: [["Team"]],
        },
        {
            range: "C5",
            values: [[game.teamNames[0]]],
        },
        {
            range: "M5",
            values: [["Score"]],
        },
        {
            range: "N5",
            values: [[game.score[0]]],
        },
        {
            range: "P5",
            values: [["Status"]],
        },
        {
            range: "R5",
            values: [["Team"]],
        },
        {
            range: "S5",
            values: [[game.teamNames[1]]],
        },
        {
            range: "AC5",
            values: [["Score"]],
        },
        {
            range: "AD5",
            values: [[game.score[1]]],
        },
    ];
    const firstLineUpdateResponse: BatchUpdateValuesResponse = await gapi.client.sheets.spreadsheets.values.batchUpdate(
        {
            spreadsheetId: uiState.sheetsState.sheetId,
            resource: {
                data: firstLineData,
                valueInputOption: "RAW",
            },
        }
    );

    console.log("Result from first line update");
    console.log(firstLineUpdateResponse);

    try {
        const sheet = await gapi.client.sheets.spreadsheets.get({
            // spreadsheetId: "1dtqzA0cxrR6PlI6j1aKBjZu0kK1MLJKEcKF6N8lq19k",
            spreadsheetId: "1h9Cxj3kNyQDse3uUWLOB8yqTCf8Kmc5DEzKu-UqzVUQ",
            ranges: "Scoresheet template",
        });
        console.log("Sheet from GDoc");
        console.log(sheet);
    } catch (error) {
        console.error(error);
    }
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
        try {
            gapi.load("client:auth2", async () => {
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
            });
        } catch (error) {
            console.log("Couldn't initialize Sheets API");
            console.log(error);
            uiState.setSheetsApiInitialized(LoadingState.Error);
            reject(error);
        }
    });

    await promise;
}
