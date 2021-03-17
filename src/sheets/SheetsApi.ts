import { IStatus } from "src/IStatus";
import { LoadingState } from "src/state/SheetState";
import { UIState } from "src/state/UIState";
import { ISheetsApi, ISheetsBatchGetResponse, ISheetsGetResponse } from "./ISheetsApi";

declare const __GOOGLE_CLIENT_ID__: string;

export const SheetsApi: ISheetsApi = {
    initializeIfNeeded: async (uiState: UIState): Promise<void> => {
        if (
            uiState.sheetsState.apiInitialized === LoadingState.Loading ||
            uiState.sheetsState.apiInitialized === LoadingState.Loaded
        ) {
            return;
        }

        // Bit of a hacky wait to wait until the callback is done
        uiState.sheetsState.setSheetsApiInitialized(LoadingState.Loading);
        const promise: Promise<void> = new Promise<void>((resolve, reject) => {
            gapi.load("client:auth2", async () => {
                try {
                    await gapi.client.init({
                        clientId: __GOOGLE_CLIENT_ID__,
                        discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
                        scope: "https://www.googleapis.com/auth/spreadsheets",
                    });

                    const authInstance: gapi.auth2.GoogleAuth = gapi.auth2.getAuthInstance();
                    const isSignedIn: boolean = authInstance.isSignedIn.get();
                    if (!isSignedIn) {
                        await authInstance.signIn();
                    }

                    uiState.sheetsState.setSheetsApiInitialized(LoadingState.Loaded);
                    resolve();
                } catch (error) {
                    uiState.sheetsState.setSheetsApiInitialized(LoadingState.Error);
                    reject(error);
                }
            });
        });

        await promise;
    },
    batchClear: async (uiState: UIState, ranges: string[] | undefined): Promise<IStatus> => {
        if (uiState.sheetsState?.sheetId == undefined) {
            return {
                isError: true,
                status: "No Sheet given",
            };
        }

        const spreadsheetId: string = uiState.sheetsState.sheetId;
        try {
            await gapi.client.sheets.spreadsheets.values.batchClear({
                spreadsheetId,
                resource: {
                    ranges,
                },
            });

            return {
                isError: false,
                status: "",
            };
        } catch (e) {
            const error: Error = e;
            return {
                isError: true,
                status: error.message,
            };
        }
    },
    batchGet: async (uiState: UIState, ranges: string[]): Promise<ISheetsBatchGetResponse> => {
        if (uiState.sheetsState?.sheetId == undefined) {
            return {
                success: false,
                errorMessage: "No Sheet specified",
            };
        }

        const spreadsheetId: string = uiState.sheetsState.sheetId;

        const valuesResponse: gapi.client.Response<gapi.client.sheets.BatchGetValuesResponse> = await gapi.client.sheets.spreadsheets.values.batchGet(
            {
                spreadsheetId,
                ranges,
            }
        );

        if (valuesResponse.status != 200) {
            return {
                success: false,
                errorMessage: `Failed to load the sheet from Google Sheets (${valuesResponse.status}). Error: ${valuesResponse.body}`,
            };
        }

        const valueRanges: gapi.client.sheets.ValueRange[] = valuesResponse.result.valueRanges ?? [];
        return {
            success: true,
            valueRanges,
        };
    },
    batchUpdate: async (uiState: UIState, valueRanges: gapi.client.sheets.ValueRange[]): Promise<IStatus> => {
        if (uiState.sheetsState?.sheetId == undefined) {
            return {
                isError: true,
                status: "No Sheet given",
            };
        }

        // TODO: Look at the return response and check for any warnings. We would make sure that the number of ranges
        // updated matched what was passed into valueRanges
        const spreadsheetId: string = uiState.sheetsState.sheetId;
        try {
            await gapi.client.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                resource: {
                    data: valueRanges,
                    valueInputOption: "RAW",
                },
            });

            return {
                isError: false,
                status: "",
            };
        } catch (e) {
            const error: Error = e;
            return {
                isError: true,
                status: error.message,
            };
        }
    },
    get: async (uiState: UIState, range: string): Promise<ISheetsGetResponse> => {
        if (uiState.sheetsState?.sheetId == undefined) {
            return {
                success: false,
                errorMessage: "No Sheet specified",
            };
        }

        const spreadsheetId: string = uiState.sheetsState.sheetId;

        const valuesResponse: gapi.client.Response<gapi.client.sheets.ValueRange> = await gapi.client.sheets.spreadsheets.values.get(
            {
                spreadsheetId,
                range,
            }
        );

        if (valuesResponse.status != 200) {
            return {
                success: false,
                errorMessage: `Failed to load the sheet from Google Sheets (${valuesResponse.status}). Error: ${valuesResponse.body}`,
            };
        }

        const valueRange: gapi.client.sheets.ValueRange = valuesResponse.result;
        return {
            success: true,
            valueRange,
        };
    },
};
