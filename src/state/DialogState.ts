import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";
import { AddQuestionDialogState } from "./AddQuestionsDialogState";
import { CustomizeGameFormatState } from "./CustomizeGameFormatState";
import { IGameFormat } from "./IGameFormat";
import { IMessageDialogState, MessageDialogType } from "./IMessageDialogState";
import { RenamePlayerDialogState } from "./RenamePlayerDialogState";
import { Player } from "./TeamState";
import { ReorderPlayersDialogState } from "./ReorderPlayersDialogState";
import { FontDialogState } from "./FontDialogState";
import { ModalVisibilityStatus } from "./ModalVisibilityStatus";
import { RenameTeamDialogState } from "./RenameTeamDialogState";
import { ImportFromQBJDialogState } from "./ImportFromQBJDialogState";

export class DialogState {
    @ignore
    public addQuestions: AddQuestionDialogState | undefined;

    @ignore
    public customizeGameFormat: CustomizeGameFormatState | undefined;

    @ignore
    public fontDialog: FontDialogState | undefined;

    @ignore
    public importFromQBJDialog: ImportFromQBJDialogState | undefined;

    @ignore
    public messageDialog: IMessageDialogState | undefined;

    @ignore
    public renamePlayerDialog: RenamePlayerDialogState | undefined;

    @ignore
    public renameTeamDialog: RenameTeamDialogState | undefined;

    @ignore
    public reorderPlayersDialog: ReorderPlayersDialogState | undefined;

    @ignore
    public visibleDialog: ModalVisibilityStatus;

    constructor() {
        makeAutoObservable(this);

        this.addQuestions = undefined;
        this.customizeGameFormat = undefined;
        this.fontDialog = undefined;
        this.importFromQBJDialog = undefined;
        this.messageDialog = undefined;
        this.renamePlayerDialog = undefined;
        this.renameTeamDialog = undefined;
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

    public hideImportFromQBJDialog(): void {
        this.importFromQBJDialog = undefined;
        if (this.visibleDialog === ModalVisibilityStatus.ImportFromQBJ) {
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

    public hideRenameTeamDialog(): void {
        this.renameTeamDialog = undefined;
        if (this.visibleDialog === ModalVisibilityStatus.RenameTeam) {
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
        this.customizeGameFormat = new CustomizeGameFormatState(gameFormat);
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

    public showImportFromQBJDialog(): void {
        this.importFromQBJDialog = new ImportFromQBJDialogState();
        this.visibleDialog = ModalVisibilityStatus.ImportFromQBJ;
    }

    public showRenamePlayerDialog(player: Player): void {
        this.renamePlayerDialog = new RenamePlayerDialogState(player);
        this.visibleDialog = ModalVisibilityStatus.RenamePlayer;
    }

    public showRenameTeamDialog(initialTeamName: string): void {
        this.renameTeamDialog = new RenameTeamDialogState(initialTeamName);
        this.visibleDialog = ModalVisibilityStatus.RenameTeam;
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
