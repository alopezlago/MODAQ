import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";

import { IStatus } from "../IStatus";

export class SheetState {
    @ignore
    public apiInitialized: LoadingState;

    public clientId: string | undefined;

    @ignore
    public expiresAt: number | undefined;

    @ignore
    public exportStatus: IStatus | undefined;

    @ignore
    public exportState: ExportState | undefined;

    @ignore
    public rosterLoadStatus: IStatus | undefined;

    @ignore
    public rosterLoadState: LoadingState | undefined;

    // We need to remember sheetId, since we only input it when creating the game
    public sheetId?: string;

    // We want to remember the round number, so we can keep exporting to the same round
    public roundNumber?: number;

    // We want to remember the sheet type so we can auto-fill it when we export
    public sheetType?: SheetType;

    constructor() {
        makeAutoObservable(this);

        this.apiInitialized = LoadingState.Unloaded;
        this.clientId = undefined;
        this.expiresAt = undefined;
        this.exportStatus = undefined;
        this.exportState = undefined;
        this.rosterLoadStatus = undefined;
        this.rosterLoadState = undefined;
        this.roundNumber = undefined;
        this.sheetId = undefined;
        this.sheetType = undefined;
    }

    public clearExpiresAt(): void {
        this.expiresAt = undefined;
    }

    public clearExportStatus(): void {
        this.exportStatus = undefined;
        this.exportState = undefined;
    }

    public clearRoundNumber(): void {
        this.roundNumber = undefined;
    }

    public clearSheetType(): void {
        this.sheetType = undefined;
    }

    public setClientId(clientId: string | undefined): void {
        this.clientId = clientId;
    }

    public setExpiresAt(expiresAt: number): void {
        this.expiresAt = expiresAt;
    }

    public setExportStatus(status: IStatus, state: ExportState | undefined = undefined): void {
        this.exportStatus = status;

        if (state != undefined) {
            this.exportState = state;
        }
    }

    public setRosterLoadStatus(status: IStatus, state: LoadingState | undefined = undefined): void {
        this.rosterLoadStatus = status;

        if (state != undefined) {
            this.rosterLoadState = state;
        }
    }

    public setSheetsApiInitialized(state: LoadingState): void {
        this.apiInitialized = state;
    }

    public setSheetId(sheetId: string): void {
        this.sheetId = sheetId;
    }

    public setSheetType(sheetType: SheetType): void {
        this.sheetType = sheetType;
    }

    public setRoundNumber(roundNumber: number): void {
        this.roundNumber = roundNumber;
    }
}

export const enum LoadingState {
    Unloaded = 0,
    Loading = 1,
    Loaded = 2,
    Error = 3,
}

export const enum ExportState {
    CheckingOvewrite = 0,
    OverwritePrompt = 1,
    Exporting = 2,
    Success = 3,
    Error = 4,
}

export const enum SheetType {
    /**
     * DEPRECATED
     */
    Lifsheets = 0,
    TJSheets = 1,
    UCSDSheets = 2,
}
