import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";
import { CustomizeGameFormatDialogState } from "./CustomizeGameFormatDialogState";
import { IGameFormat } from "./IGameFormat";

export class DialogState {
    @ignore
    public customizeGameFormat: CustomizeGameFormatDialogState | undefined;

    @ignore
    public exportToJsonDialogVisible: boolean;

    @ignore
    public helpDialogVisible: boolean;

    @ignore
    public importGameDialogVisible: boolean;

    @ignore
    public newGameDialogVisible: boolean;

    constructor() {
        makeAutoObservable(this);

        this.customizeGameFormat = undefined;
        this.exportToJsonDialogVisible = false;
        this.helpDialogVisible = false;
        this.importGameDialogVisible = false;
        this.newGameDialogVisible = false;
    }

    public hideCustomizeGameFormatDialog(): void {
        this.customizeGameFormat = undefined;
    }

    public hideExportToJsonDialog(): void {
        this.exportToJsonDialogVisible = false;
    }

    public hideHelpDialog(): void {
        this.helpDialogVisible = false;
    }

    public hideImportGameDialog(): void {
        this.importGameDialogVisible = false;
    }

    public hideNewGameDialog(): void {
        this.newGameDialogVisible = false;
    }

    public showCustomizeGameFormatDialog(gameFormat: IGameFormat): void {
        this.customizeGameFormat = new CustomizeGameFormatDialogState(gameFormat);
    }

    public showExportToJsonDialog(): void {
        this.exportToJsonDialogVisible = true;
    }

    public showHelpDialog(): void {
        this.helpDialogVisible = true;
    }

    public showImportGameDialog(): void {
        this.importGameDialogVisible = true;
    }

    public showNewGameDialog(): void {
        this.newGameDialogVisible = true;
    }
}
