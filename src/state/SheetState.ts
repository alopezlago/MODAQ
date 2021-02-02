import { action, observable } from "mobx";
import { ignore } from "mobx-sync";

import { IStatus } from "src/IStatus";

export class SheetState {
    @observable
    @ignore
    apiInitialized: LoadingState;

    @observable
    @ignore
    public exportStatus: IStatus | undefined;

    @observable
    @ignore
    public exportState: ExportState | undefined;

    @observable
    @ignore
    public rosterLoadStatus: IStatus | undefined;

    @observable
    @ignore
    public rosterLoadState: LoadingState | undefined;

    @observable
    @ignore
    public sheetId?: string;

    @observable
    @ignore
    public roundNumber?: number;

    constructor() {
        this.apiInitialized = LoadingState.Unloaded;
        this.exportStatus = undefined;
        this.exportState = undefined;
        this.rosterLoadStatus = undefined;
        this.rosterLoadState = undefined;
        this.sheetId = undefined;
        this.roundNumber = undefined;
    }

    @action
    public clearExportStatus(): void {
        this.exportStatus = undefined;
        this.exportState = undefined;
    }

    @action
    public clearRoundNumber(): void {
        this.roundNumber = undefined;
    }

    @action
    public setExportStatus(status: IStatus, state: ExportState | undefined = undefined): void {
        this.exportStatus = status;

        if (state != undefined) {
            this.exportState = state;
        }
    }

    @action
    public setRosterLoadStatus(status: IStatus, state: LoadingState | undefined = undefined): void {
        this.rosterLoadStatus = status;

        if (state != undefined) {
            this.rosterLoadState = state;
        }
    }

    @action
    public setSheetId(sheetId: string): void {
        this.sheetId = sheetId;
    }

    @action
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
