import { IStatus } from "src/IStatus";
import { UIState } from "src/state/UIState";

export interface ISheetsApi {
    initializeIfNeeded(uiState: UIState): Promise<void>;

    batchClear(uiState: UIState, ranges: string[] | undefined): Promise<IStatus>;
    batchUpdate(uiState: UIState, valueRanges: gapi.client.sheets.ValueRange[]): Promise<IStatus>;
    get(uiState: UIState, range: string): Promise<ISheetsGetResponse>;
}

export type ISheetsGetResponse = ISheetsGetFailureResponse | ISheetsGetSuccessResponse;

interface ISheetsGetFailureResponse {
    success: false;
    errorMessage: string;
}

interface ISheetsGetSuccessResponse {
    success: true;
    valueRange: gapi.client.sheets.ValueRange;
}
