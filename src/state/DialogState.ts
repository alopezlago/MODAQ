import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";
import { AddQuestionDialogState } from "./AddQuestionsDialogState";
import { CustomizeGameFormatDialogState } from "./CustomizeGameFormatDialogState";
import { IGameFormat } from "./IGameFormat";
import { IMessageDialogState, MessageDialogType } from "./IMessageDialogState";

export class DialogState {
    @ignore
    public addQuestions: AddQuestionDialogState | undefined;

    @ignore
    public customizeGameFormat: CustomizeGameFormatDialogState | undefined;

    @ignore
    public exportToJsonDialogVisible: boolean;

    @ignore
    public helpDialogVisible: boolean;

    @ignore
    public importGameDialogVisible: boolean;

    @ignore
    public messageDialog: IMessageDialogState | undefined;

    @ignore
    public newGameDialogVisible: boolean;

    constructor() {
        makeAutoObservable(this);

        this.addQuestions = undefined;
        this.customizeGameFormat = undefined;
        this.exportToJsonDialogVisible = false;
        this.helpDialogVisible = false;
        this.importGameDialogVisible = false;
        this.messageDialog = undefined;
        this.newGameDialogVisible = false;
    }

    public hideAddQuestionsDialog(): void {
        this.addQuestions = undefined;
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

    public hideMessageDialog(): void {
        this.messageDialog = undefined;
    }

    public hideNewGameDialog(): void {
        this.newGameDialogVisible = false;
    }

    public showAddQuestionsDialog(): void {
        this.addQuestions = new AddQuestionDialogState();
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

    public showOKMessageDialog(title: string, message: string, onOK?: () => void): void {
        this.messageDialog = {
            title,
            message,
            type: MessageDialogType.OK,
            onOK,
        };
    }

    public showOKCancelMessageDialog(title: string, message: string, onOK: () => void): void {
        this.messageDialog = {
            title,
            message,
            type: MessageDialogType.OKCancel,
            onOK,
        };
    }

    public showNewGameDialog(): void {
        this.newGameDialogVisible = true;
    }
}
