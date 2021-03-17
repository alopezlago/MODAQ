import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";

export class DialogState {
    @ignore
    public editFormatDialogVisible: boolean;

    @ignore
    public exportToJsonDialogVisible: boolean;

    @ignore
    public importGameDialogVisible: boolean;

    @ignore
    public newGameDialogVisible: boolean;

    constructor() {
        makeAutoObservable(this);

        this.editFormatDialogVisible = false;
        this.exportToJsonDialogVisible = false;
        this.importGameDialogVisible = false;
        this.newGameDialogVisible = false;
    }

    public hideEditformatDialog(): void {
        this.editFormatDialogVisible = false;
    }

    public hideExportToJsonDialog(): void {
        this.exportToJsonDialogVisible = false;
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

    public showImportGameDialog(): void {
        this.importGameDialogVisible = true;
    }

    public showNewGameDialog(): void {
        this.newGameDialogVisible = true;
    }
}
