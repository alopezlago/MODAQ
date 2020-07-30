import { observable } from "mobx";
import { ignore } from "mobx-sync";

export class SheetState {
    @observable
    @ignore
    apiInitialized: LoadingState;

    @observable
    sheetId?: string;

    constructor() {
        this.apiInitialized = LoadingState.Unloaded;
        this.sheetId = undefined;
    }
}

export const enum LoadingState {
    Unloaded = 0,
    Loading = 1,
    Loaded = 2,
    Error = 3,
}
