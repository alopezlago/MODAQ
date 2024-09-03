import { ImportFromQBJDialogState, ImportFromQBJPivotKey } from "../../state/ImportFromQBJDialogState";
import * as QBJ from "../../qbj/QBJ";
import { AppState } from "../../state/AppState";
import { IResult } from "../../IResult";
import { GameState } from "../../state/GameState";
import { PacketState } from "../../state/PacketState";

export function hideDialog(): void {
    AppState.instance.uiState.clearPacketStatus();
    AppState.instance.uiState.dialogState.hideImportFromQBJDialog();
}

export function loadPacket(packet: PacketState): void {
    AppState.instance.uiState.dialogState.importFromQBJDialog?.setPacket(packet);
}

export function onSubmit(): void {
    const appState: AppState = AppState.instance;
    const dialogState: ImportFromQBJDialogState | undefined = appState.uiState.dialogState.importFromQBJDialog;

    if (dialogState == undefined) {
        return;
    }

    dialogState.resetConvertErrorMessage();

    if (dialogState.match == undefined) {
        dialogState.setConvertErrorMessage("A valid QBJ match must be loaded.", ImportFromQBJPivotKey.Match);
        return;
    } else if (dialogState.packet == undefined) {
        dialogState.setConvertErrorMessage("A valid packet must be loaded.", ImportFromQBJPivotKey.Packet);
        return;
    }

    const gameResult: IResult<GameState> = QBJ.fromQBJ(
        dialogState.match,
        dialogState.packet,
        dialogState.customizeGameFormat.gameFormat
    );
    if (!gameResult.success) {
        dialogState.setConvertErrorMessage(gameResult.message);
        return;
    }

    appState.setGame(gameResult.value);

    hideDialog();
}

export function onPivotChange(pivotKey: ImportFromQBJPivotKey): void {
    AppState.instance.uiState.dialogState.importFromQBJDialog?.setPivotKey(pivotKey);
}

export function onQBJFileChange(file: File): void {
    const fileReader = new FileReader();
    fileReader.onload = onLoadQBJ;

    AppState.instance.uiState.dialogState.importFromQBJDialog?.resetQbjStatus();

    // QBJ isn't a generally defined file type, so looking at file.type gives us nothing.
    fileReader.readAsText(file);
}

function onLoadQBJ(event: ProgressEvent<FileReader>): void {
    if (event.target == undefined || event.target.result == undefined || typeof event.target.result !== "string") {
        return;
    }

    const match: QBJ.IMatch = JSON.parse(event.target.result);
    const dialogState: ImportFromQBJDialogState | undefined = AppState.instance.uiState.dialogState.importFromQBJDialog;
    if (dialogState == undefined) {
        return;
    }

    dialogState.setMatch(match);
}
