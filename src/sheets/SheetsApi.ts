import { IStatus } from "../IStatus";
import { LoadingState } from "../state/SheetState";
import { UIState } from "../state/UIState";
import { ISheetsApi, ISheetsBatchGetResponse, ISheetsGetResponse } from "./ISheetsApi";

const timedOutMessage = "Timed out signing into Google Sheets";

export const SheetsApi: ISheetsApi = {
    initializeIfNeeded: async (uiState: UIState): Promise<void> => {
        if (
            uiState.sheetsState.apiInitialized === LoadingState.Loading ||
            uiState.sheetsState.apiInitialized === LoadingState.Loaded
        ) {
            return;
        }

        // Bit of a hacky wait to wait until the callback is done
        // Need to follow this approach: https://developers.google.com/identity/oauth2/web/guides/migration-to-gis#gapi-asyncawait
        uiState.sheetsState.setSheetsApiInitialized(LoadingState.Loading);

        const promise: Promise<void> = new Promise<void>(async (resolve, reject) => {
            try {
                // Load gapi first, then load the GIS client
                await new Promise<void>((resolve) => {
                    gapi.load("client", resolve);
                });

                // Typings issue, init isn't listed as a method
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (gapi.client as any).init({});

                await gapi.client.load("https://sheets.googleapis.com/$discovery/rest?version=v4");

                const clientId: string | undefined = uiState.sheetsState.clientId;
                if (clientId == undefined) {
                    reject(new Error("No clientId specified"));
                    return;
                }

                // If the user hasn't done anything after 2 minutes, go back to keeping this uninitialized so they can
                // sign in again
                const cancelSignIn = setTimeout(() => {
                    if (uiState.sheetsState.apiInitialized === LoadingState.Loading) {
                        uiState.sheetsState.setSheetsApiInitialized(LoadingState.Unloaded);
                        uiState.sheetsState.setRosterLoadStatus(
                            {
                                isError: false,
                                status: timedOutMessage,
                            },
                            LoadingState.Unloaded
                        );
                        reject(timedOutMessage);
                    }
                }, 2 * 60 * 1000);

                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: "https://www.googleapis.com/auth/spreadsheets",
                    callback: (tokenResponse) => {
                        clearTimeout(cancelSignIn);

                        if (tokenResponse.error != null) {
                            uiState.sheetsState.setSheetsApiInitialized(LoadingState.Error);
                            reject(tokenResponse.error_description);
                            return;
                        }

                        uiState.sheetsState.setSheetsApiInitialized(LoadingState.Loaded);
                        resolve();
                    },
                });

                tokenClient.requestAccessToken();
            } catch (error) {
                uiState.sheetsState.setSheetsApiInitialized(LoadingState.Error);
                reject(error);
            }
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
            const error: Error = e as Error;
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
            const error: Error = e as Error;
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
