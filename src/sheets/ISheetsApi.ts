import { IStatus } from "../IStatus";
import { UIState } from "../state/UIState";

export interface ISheetsApi {
    initializeIfNeeded(uiState: UIState): Promise<void>;

    batchClear(uiState: UIState, ranges: string[] | undefined): Promise<IStatus>;
    batchGet(uiState: UIState, ranges: string[]): Promise<ISheetsBatchGetResponse>;
    batchUpdate(uiState: UIState, valueRanges: gapi.client.sheets.ValueRange[]): Promise<IStatus>;
    get(uiState: UIState, range: string): Promise<ISheetsGetResponse>;
}

export type ISheetsGetResponse = ISheetsGetFailureResponse | ISheetsGetSuccessResponse;

export type ISheetsBatchGetResponse = ISheetsGetFailureResponse | ISheetsBatchGetSuccessResponse;

interface ISheetsGetFailureResponse {
    success: false;
    errorMessage: string;
}

interface ISheetsBatchGetSuccessResponse {
    success: true;
    valueRanges: gapi.client.sheets.ValueRange[];
}

interface ISheetsGetSuccessResponse {
    success: true;
    valueRange: gapi.client.sheets.ValueRange;
}
