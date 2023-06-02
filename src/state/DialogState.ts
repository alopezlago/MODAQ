import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";
import { AddQuestionDialogState } from "./AddQuestionsDialogState";
import { CustomizeGameFormatDialogState } from "./CustomizeGameFormatDialogState";
import { IGameFormat } from "./IGameFormat";
import { IMessageDialogState, MessageDialogType } from "./IMessageDialogState";
import { RenamePlayerDialogState } from "./RenamePlayerDialogState";
import { Player } from "./TeamState";
import { ReorderPlayersDialogState } from "./ReorderPlayersDialogState";

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

    @ignore
    public renamePlayerDialog: RenamePlayerDialogState | undefined;

    @ignore
    public reorderPlayersDialog: ReorderPlayersDialogState | undefined;

    constructor() {
        makeAutoObservable(this);

        this.addQuestions = undefined;
        this.customizeGameFormat = undefined;
        this.exportToJsonDialogVisible = false;
        this.helpDialogVisible = false;
        this.importGameDialogVisible = false;
        this.messageDialog = undefined;
        this.newGameDialogVisible = false;
        this.renamePlayerDialog = undefined;
        this.reorderPlayersDialog = undefined;
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

    public hideRenamePlayerDialog(): void {
        this.renamePlayerDialog = undefined;
    }

    public hideReorderPlayersDialog(): void {
        this.reorderPlayersDialog = undefined;
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

    public showRenamePlayerDialog(player: Player): void {
        this.renamePlayerDialog = new RenamePlayerDialogState(player);
    }

    public showReorderPlayersDialog(players: Player[]): void {
        this.reorderPlayersDialog = new ReorderPlayersDialogState(players);
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

    public showYesNoCancelMessageDialog(title: string, message: string, onYes: () => void, onNo: () => void): void {
        this.messageDialog = {
            title,
            message,
            type: MessageDialogType.YesNocCancel,
            onOK: onYes,
            onNo,
        };
    }

    public showNewGameDialog(): void {
        this.newGameDialogVisible = true;
    }
}
