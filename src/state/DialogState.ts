import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";
import { AddQuestionDialogState } from "./AddQuestionsDialogState";
import { CustomizeGameFormatDialogState } from "./CustomizeGameFormatDialogState";
import { IGameFormat } from "./IGameFormat";
import { IMessageDialogState, MessageDialogType } from "./IMessageDialogState";
import { RenamePlayerDialogState } from "./RenamePlayerDialogState";
import { Player } from "./TeamState";
import { ReorderPlayersDialogState } from "./ReorderPlayersDialogState";
import { FontDialogState } from "./FontDialogState";
import { ModalVisibilityStatus } from "./ModalVisibilityStatus";

export class DialogState {
    @ignore
    public addQuestions: AddQuestionDialogState | undefined;

    @ignore
    public customizeGameFormat: CustomizeGameFormatDialogState | undefined;

    @ignore
    public fontDialog: FontDialogState | undefined;

    @ignore
    public messageDialog: IMessageDialogState | undefined;

    @ignore
    public renamePlayerDialog: RenamePlayerDialogState | undefined;

    @ignore
    public reorderPlayersDialog: ReorderPlayersDialogState | undefined;

    @ignore
    public visibleDialog: ModalVisibilityStatus;

    constructor() {
        makeAutoObservable(this);

        this.addQuestions = undefined;
        this.customizeGameFormat = undefined;
        this.fontDialog = undefined;
        this.messageDialog = undefined;
        this.renamePlayerDialog = undefined;
        this.reorderPlayersDialog = undefined;
        this.visibleDialog = ModalVisibilityStatus.None;
    }

    public hideAddQuestionsDialog(): void {
        this.addQuestions = undefined;
        if (this.visibleDialog === ModalVisibilityStatus.AddQuestions) {
            this.hideModalDialog();
        }
    }

    public hideCustomizeGameFormatDialog(): void {
        this.customizeGameFormat = undefined;
        if (this.visibleDialog === ModalVisibilityStatus.CustomizeGameFormat) {
            this.hideModalDialog();
        }
    }

    public hideModalDialog(): void {
        this.visibleDialog = ModalVisibilityStatus.None;
    }

    public hideFontDialog(): void {
        this.fontDialog = undefined;
        if (this.visibleDialog === ModalVisibilityStatus.Font) {
            this.hideModalDialog();
        }
    }

    public hideMessageDialog(): void {
        this.messageDialog = undefined;
        if (this.visibleDialog === ModalVisibilityStatus.Message) {
            this.hideModalDialog();
        }
    }

    public hideRenamePlayerDialog(): void {
        this.renamePlayerDialog = undefined;
        if (this.visibleDialog === ModalVisibilityStatus.RenamePlayer) {
            this.hideModalDialog();
        }
    }

    public hideReorderPlayersDialog(): void {
        this.reorderPlayersDialog = undefined;
        if (this.visibleDialog === ModalVisibilityStatus.ReorderPlayers) {
            this.hideModalDialog();
        }
    }

    public showAddQuestionsDialog(): void {
        this.addQuestions = new AddQuestionDialogState();
        this.visibleDialog = ModalVisibilityStatus.AddQuestions;
    }

    public showCustomizeGameFormatDialog(gameFormat: IGameFormat): void {
        this.customizeGameFormat = new CustomizeGameFormatDialogState(gameFormat);
        this.visibleDialog = ModalVisibilityStatus.CustomizeGameFormat;
    }

    public showExportToJsonDialog(): void {
        this.visibleDialog = ModalVisibilityStatus.ExportToJson;
    }

    public showFontDialog(
        existingFontFamily: string,
        existingFontSize: number,
        existingTextColor: string | undefined,
        existingPronunciationGuideColor: string | undefined
    ): void {
        this.fontDialog = new FontDialogState(
            existingFontFamily,
            existingFontSize,
            existingTextColor,
            existingPronunciationGuideColor
        );
        this.visibleDialog = ModalVisibilityStatus.Font;
    }

    public showHelpDialog(): void {
        this.visibleDialog = ModalVisibilityStatus.Help;
    }

    public showImportGameDialog(): void {
        this.visibleDialog = ModalVisibilityStatus.ImportGame;
    }

    public showRenamePlayerDialog(player: Player): void {
        this.renamePlayerDialog = new RenamePlayerDialogState(player);
        this.visibleDialog = ModalVisibilityStatus.RenamePlayer;
    }

    public showReorderPlayersDialog(players: Player[]): void {
        this.reorderPlayersDialog = new ReorderPlayersDialogState(players);
        this.visibleDialog = ModalVisibilityStatus.ReorderPlayers;
    }

    public showScoresheetDialog(): void {
        this.visibleDialog = ModalVisibilityStatus.Scoresheet;
    }

    public showOKMessageDialog(title: string, message: string, onOK?: () => void): void {
        this.messageDialog = {
            title,
            message,
            type: MessageDialogType.OK,
            onOK,
        };
        this.visibleDialog = ModalVisibilityStatus.Message;
    }

    public showOKCancelMessageDialog(title: string, message: string, onOK: () => void): void {
        this.messageDialog = {
            title,
            message,
            type: MessageDialogType.OKCancel,
            onOK,
        };
        this.visibleDialog = ModalVisibilityStatus.Message;
    }

    public showYesNoCancelMessageDialog(title: string, message: string, onYes: () => void, onNo: () => void): void {
        this.messageDialog = {
            title,
            message,
            type: MessageDialogType.YesNocCancel,
            onOK: onYes,
            onNo: onNo,
        };
        this.visibleDialog = ModalVisibilityStatus.Message;
    }

    public showNewGameDialog(): void {
        this.visibleDialog = ModalVisibilityStatus.NewGame;
    }
}
