import { assertNever } from "@fluentui/utilities";
import { makeAutoObservable } from "mobx";
import { IStatus } from "src/IStatus";
import { ICustomExport } from "./CustomExport";

import * as CustomExport from "./CustomExport";
import * as QBJ from "../qbj/QBJ";
import { GameState } from "./GameState";
import { UIState } from "./UIState";

export class AppState {
    public game: GameState;

    public uiState: UIState;

    constructor() {
        makeAutoObservable(this);

        this.game = new GameState();
        this.uiState = new UIState();
    }

    public handleCustomExport(): Promise<void> {
        if (this.uiState.customExport == undefined) {
            return Promise.resolve();
        }

        const customExport: ICustomExport = this.uiState.customExport;
        let exportPromise: Promise<IStatus> | undefined;
        switch (customExport.type) {
            case "Raw":
                exportPromise = customExport.onExport(CustomExport.convertGameToExportFields(this.game));
                break;
            case "QBJ":
                exportPromise = customExport.onExport(QBJ.toQBJ(this.game));
                break;
            default:
                assertNever(customExport);
        }

        return exportPromise
            .then((status) => {
                if (status.isError) {
                    this.uiState.dialogState.showOKMessageDialog("Export Error", `Export failed: ${status.status}.`);
                } else {
                    this.uiState.dialogState.showOKMessageDialog("Export Succeeded", "Export succeeded.");
                }
            })
            .catch((e) => {
                this.uiState.dialogState.showOKMessageDialog(
                    "Export Error",
                    `Error in exporting the game. Hit an exception. Exception message: ${e.message}`
                );
            });
    }
}
