import { assertNever } from "@fluentui/utilities";
import { makeAutoObservable } from "mobx";
import { IStatus } from "../IStatus";
import { ICustomExport } from "./CustomExport";

import * as CustomExport from "./CustomExport";
import * as QBJ from "../qbj/QBJ";
import { GameState } from "./GameState";
import { UIState } from "./UIState";
import { StatusDisplayType } from "./StatusDisplayType";

const minimumIntervalInMs = 5000;

export class AppState {
    public static instance: AppState = new AppState();

    public game: GameState;

    public uiState: UIState;

    constructor() {
        makeAutoObservable(this);

        this.game = new GameState();
        this.uiState = new UIState();
    }

    // Only use in tests
    public static resetInstance(): void {
        this.instance = new AppState();
    }

    // Could do a version with callbacks. There are 4 places this gets called from, and 3 use the same callback
    // Could also just do a bool, and pass in a different value (e.g. enum) if we want more flexibility in the future
    public handleCustomExport(displayType: StatusDisplayType, source: CustomExport.ExportSource): Promise<void> {
        // Custom export must be defined and we must have an existing game
        if (
            this.uiState == undefined ||
            this.uiState.customExportOptions == undefined ||
            this.game.cycles.length === 0
        ) {
            return Promise.resolve();
        }

        const customExport: ICustomExport = this.uiState.customExportOptions;
        let exportPromise: Promise<IStatus> | undefined;
        switch (customExport.type) {
            case "Raw":
                exportPromise = customExport.onExport(CustomExport.convertGameToExportFields(this.game), { source });
                break;
            case "QBJ":
                exportPromise = customExport.onExport(
                    QBJ.toQBJ(this.game, this.game.packet.name ?? this.uiState.packetFilename),
                    { source }
                );
                break;
            default:
                assertNever(customExport);
        }

        return exportPromise
            .then((status) => {
                if (status.isError) {
                    switch (displayType) {
                        case StatusDisplayType.MessageDialog:
                            this.uiState.dialogState.showOKMessageDialog(
                                "Export Error",
                                `Export failed: ${status.status}.`
                            );
                            break;
                        case StatusDisplayType.Label:
                            this.uiState.setCustomExportStatus(`Export failed: ${status.status}.`);
                            break;
                        default:
                            assertNever(displayType);
                    }
                } else {
                    this.game.markUpdateComplete();
                    switch (displayType) {
                        case StatusDisplayType.MessageDialog:
                            this.uiState.dialogState.showOKMessageDialog("Export Succeeded", "Export succeeded.");
                            break;
                        case StatusDisplayType.Label:
                            this.uiState.setCustomExportStatus("Export successful.");
                            break;
                        default:
                            assertNever(displayType);
                    }
                }
            })
            .catch((e) => {
                const message = e.message ? e.message : JSON.stringify(e);
                switch (displayType) {
                    case StatusDisplayType.MessageDialog:
                        this.uiState.dialogState.showOKMessageDialog(
                            "Export Error",
                            `Error in exporting the game. Hit an exception. Exception message: ${message}`
                        );
                        break;
                    case StatusDisplayType.Label:
                        this.uiState.setCustomExportStatus(
                            `Error in exporting the game. Hit an exception. Exception message: ${message}`
                        );
                        break;
                    default:
                        assertNever(displayType);
                }
            });
    }

    // Need to think if we want this state in UIState or here. Odd to have the interval live elsewhere
    public setCustomExportInterval(interval: number | undefined): void {
        clearInterval(this.uiState.customExportIntervalId);

        if (interval == undefined) {
            return;
        }

        if (interval < minimumIntervalInMs) {
            interval = minimumIntervalInMs;
        }

        const newIntervalId = setInterval(() => {
            // Only export if the game has changes. We do this check here instead of handleCustomExport because the
            // user should be able to explicitly export multiple times (to create new files, for example), but that doesn't
            // make sense to do for something running from the timer.
            if (this.game.hasUpdates) {
                this.handleCustomExport(StatusDisplayType.Label, "Timer");
            }
        }, interval);
        this.uiState.setCustomExportIntervalId(newIntervalId);
    }

    public setGame(game: GameState): void {
        this.game = game;
    }
}
