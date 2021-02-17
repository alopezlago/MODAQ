import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";

import { IStatus } from "src/IStatus";

export class SheetState {
    @ignore
    apiInitialized: LoadingState;

    @ignore
    public exportStatus: IStatus | undefined;

    @ignore
    public exportState: ExportState | undefined;

    @ignore
    public rosterLoadStatus: IStatus | undefined;

    @ignore
    public rosterLoadState: LoadingState | undefined;

    @ignore
    public sheetId?: string;

    @ignore
    public roundNumber?: number;

    constructor() {
        makeAutoObservable(this);

        this.apiInitialized = LoadingState.Unloaded;
        this.exportStatus = undefined;
        this.exportState = undefined;
        this.rosterLoadStatus = undefined;
        this.rosterLoadState = undefined;
        this.sheetId = undefined;
        this.roundNumber = undefined;
    }

    public clearExportStatus(): void {
        this.exportStatus = undefined;
        this.exportState = undefined;
    }

    public clearRoundNumber(): void {
        this.roundNumber = undefined;
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

    public setSheetId(sheetId: string): void {
        this.sheetId = sheetId;
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
    Exporting = 0,
    Success = 1,
    Error = 2,
}
