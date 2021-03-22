import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";

export class DialogState {
    @ignore
    public editFormatDialogVisible: boolean;

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

        this.editFormatDialogVisible = false;
        this.exportToJsonDialogVisible = false;
        this.helpDialogVisible = false;
        this.importGameDialogVisible = false;
        this.newGameDialogVisible = false;
    }

    public hideEditFormatDialog(): void {
        this.editFormatDialogVisible = false;
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

    public showEditFormatDialog(): void {
        this.editFormatDialogVisible = true;
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
