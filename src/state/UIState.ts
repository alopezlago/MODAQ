import { assertNever } from "@fluentui/react";
import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";

import * as GameFormats from "./GameFormats";
import { ITossupProtestEvent, IBonusProtestEvent } from "./Events";
import { IPendingNewGame, PendingGameType } from "./IPendingNewGame";
import { PacketState } from "./PacketState";
import { Player } from "./TeamState";
import { SheetState } from "./SheetState";
import { IStatus } from "../IStatus";
import { IPendingSheet } from "./IPendingSheet";
import { Cycle } from "./Cycle";
import { DialogState } from "./DialogState";
import { IGameFormat } from "./IGameFormat";
import { BuzzMenuState } from "./BuzzMenuState";
import { ICustomExport } from "./CustomExport";

// TODO: Look into breaking this up into individual UI component states. Lots of pendingX fields, which could be in
// their own (see CustomizeGameFormatDialogState)
// Alternatively, keep certain component-local states in the component state, and only store values that could be used
// outside of that component here.

const DefaultFontFamily = "Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif";

export class UIState {
    @ignore
    public buildVersion: string | undefined;

    // TODO: Should we also include the Cycle? This would simplify anything that needs access to the cycle
    public cycleIndex: number;

    @ignore
    public dialogState: DialogState;

    public fontFamily: string;

    @ignore
    public isEditingCycleIndex: boolean;

    @ignore
    public selectedWordIndex: number;

    @ignore
    public buzzMenuState: BuzzMenuState;

    @ignore
    public customExport: ICustomExport | undefined;

    @ignore
    public exportRoundNumber: number;

    @ignore
    public hideNewGame: boolean;

    @ignore
    public importGameStatus: IStatus | undefined;

    public packetFilename: string | undefined;

    @ignore
    public packetParseStatus: IStatus | undefined;

    @ignore
    public pendingBonusProtestEvent?: IBonusProtestEvent;

    @ignore
    public pendingNewGame?: IPendingNewGame;

    @ignore
    public pendingNewPlayer?: Player;

    @ignore
    public pendingFontFamily?: string;

    @ignore
    public pendingFontSize?: number;

    @ignore
    public pendingSheet?: IPendingSheet;

    @ignore
    public pendingTossupProtestEvent?: ITossupProtestEvent;

    // Default should be to show the clock. This setting didn't exist before, so use hide instead of show
    public isClockHidden: boolean;

    // Default should be to show the event log. This setting didn't exist before, so use hide instead of show
    public isEventLogHidden: boolean;

    public questionFontSize: number;

    public sheetsState: SheetState;

    public useDarkMode: boolean;

    public yappServiceUrl: string | undefined;

    constructor() {
        makeAutoObservable(this);

        this.buildVersion = undefined;
        this.cycleIndex = 0;
        this.dialogState = new DialogState();
        this.isEditingCycleIndex = false;
        this.selectedWordIndex = -1;
        this.buzzMenuState = {
            clearSelectedWordOnClose: true,
            visible: false,
        };
        this.customExport = undefined;
        this.exportRoundNumber = 1;
        this.hideNewGame = false;

        // Default to Fabric UI's default font (Segoe UI), then Times New Roman
        this.fontFamily = DefaultFontFamily;

        this.isClockHidden = false;
        this.isEventLogHidden = false;
        this.importGameStatus = undefined;
        this.packetFilename = undefined;
        this.packetParseStatus = undefined;
        this.pendingBonusProtestEvent = undefined;
        this.pendingNewGame = undefined;
        this.pendingNewPlayer = undefined;
        this.pendingFontFamily = undefined;
        this.pendingFontSize = undefined;
        this.pendingSheet = undefined;
        this.pendingTossupProtestEvent = undefined;
        this.useDarkMode = false;
        this.yappServiceUrl = undefined;

        // The default font size is 16px
        this.questionFontSize = 16;
        this.sheetsState = new SheetState();
    }

    // TODO: Feels off. Could generalize to array of teams
    public addPlayerToFirstTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame?.firstTeamPlayers.push(player);
        }
    }

    public addPlayerToSecondTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame?.secondTeamPlayers.push(player);
        }
    }

    public clearPacketStatus(): void {
        this.packetParseStatus = undefined;
    }

    public createPendingNewGame(): void {
        const firstTeamPlayers: Player[] = [];
        const secondTeamPlayers: Player[] = [];
        for (let i = 0; i < 4; i++) {
            firstTeamPlayers.push(new Player("", "Team 1", /* isStarter */ true));
            secondTeamPlayers.push(new Player("", "Team 2", /* isStarter */ true));
        }

        if (this.pendingNewGame == undefined) {
            this.pendingNewGame = {
                packet: new PacketState(),
                firstTeamPlayers,
                secondTeamPlayers,
                type: PendingGameType.Manual,
                gameFormat: GameFormats.ACFGameFormat,
            };
        } else {
            this.pendingNewGame = {
                ...this.pendingNewGame,
                packet: new PacketState(),
            };

            switch (this.pendingNewGame.type) {
                case PendingGameType.Manual:
                    this.pendingNewGame = {
                        ...this.pendingNewGame,
                        cycles: undefined,
                        firstTeamPlayers,
                        secondTeamPlayers,
                    };
                    break;
                case PendingGameType.Lifsheets:
                case PendingGameType.TJSheets:
                case PendingGameType.UCSDSheets:
                    break;
                default:
                    assertNever(this.pendingNewGame);
            }
        }
    }

    public createPendingNewPlayer(teamName: string): void {
        this.pendingNewPlayer = new Player("", teamName, /* isStarter */ false);
    }

    public createPendingSheet(): void {
        this.pendingSheet = {
            roundNumber: this.sheetsState.roundNumber ?? 1,
            sheetId: this.sheetsState.sheetId ?? "",
        };
    }

    public removePlayerToFirstTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.firstTeamPlayers = this.pendingNewGame?.firstTeamPlayers.filter((p) => p !== player);
        }
    }

    public removePlayerToSecondTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.secondTeamPlayers = this.pendingNewGame?.secondTeamPlayers.filter((p) => p !== player);
        }
    }

    public setFontFamily(listedFont: string): void {
        this.fontFamily = listedFont + ", " + DefaultFontFamily;
    }

    public setPendingNewGameType(type: PendingGameType): void {
        if (this.pendingNewGame != undefined) {
            // If we're changing between different Sheets types (e.g. Lifsheets and TJ Sheets), clear the pending game
            if (type != PendingGameType.Manual && this.pendingNewGame.type != PendingGameType.Manual) {
                this.pendingNewGame.firstTeamPlayersFromRosters = undefined;
                this.pendingNewGame.playersFromRosters = undefined;
                this.pendingNewGame.rostersUrl = undefined;
                this.pendingNewGame.secondTeamPlayersFromRosters = undefined;
            }

            this.pendingNewGame.type = type;
        }
    }

    public setPendingNewGameCycles(cycles: Cycle[]): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.cycles = cycles;
        }
    }

    public setPendingNewGameFormat(gameFormat: IGameFormat): void {
        if (this.pendingNewGame == undefined) {
            return;
        }

        this.pendingNewGame.gameFormat = gameFormat;
    }

    public setPendingNewGameRosters(players: Player[]): void {
        if (this.pendingNewGame == undefined) {
            return;
        }

        if (this.pendingNewGame?.type !== PendingGameType.Manual) {
            this.pendingNewGame.playersFromRosters = players;
            this.pendingNewGame.firstTeamPlayersFromRosters = [];
            this.pendingNewGame.secondTeamPlayersFromRosters = [];
        }
    }

    public setPendingNewGameRostersUrl(url: string): void {
        if (this.pendingNewGame == undefined) {
            return;
        }

        if (this.pendingNewGame?.type !== PendingGameType.Manual) {
            this.pendingNewGame.rostersUrl = url;
        }
    }

    public setPendingNewGameFirstTeamPlayers(players: Player[]): void {
        if (this.pendingNewGame?.type == undefined) {
            return;
        }

        switch (this.pendingNewGame.type) {
            case PendingGameType.Lifsheets:
            case PendingGameType.TJSheets:
            case PendingGameType.UCSDSheets:
                this.pendingNewGame.firstTeamPlayersFromRosters = players;
                break;
            case PendingGameType.Manual:
                this.pendingNewGame.firstTeamPlayers = players;
                break;
            default:
                assertNever(this.pendingNewGame);
        }
    }

    public setPendingNewGameSecondTeamPlayers(players: Player[]): void {
        if (this.pendingNewGame?.type == undefined) {
            return;
        }

        switch (this.pendingNewGame.type) {
            case PendingGameType.Lifsheets:
            case PendingGameType.TJSheets:
            case PendingGameType.UCSDSheets:
                this.pendingNewGame.secondTeamPlayersFromRosters = players;
                break;
            case PendingGameType.Manual:
                this.pendingNewGame.secondTeamPlayers = players;
                break;
            default:
                assertNever(this.pendingNewGame);
        }
    }

    public nextCycle(): void {
        this.setCycleIndex(this.cycleIndex + 1);
    }

    public previousCycle(): void {
        if (this.cycleIndex > 0) {
            this.setCycleIndex(this.cycleIndex - 1);
        }
    }

    public setCycleIndex(newIndex: number): void {
        if (newIndex >= 0) {
            this.cycleIndex = newIndex;

            // Clear the selected words, since it's not relevant to the next question
            this.selectedWordIndex = -1;
        }
    }

    public setBuildVersion(version: string | undefined): void {
        this.buildVersion = version;
    }

    public setCustomExport(customExport: ICustomExport): void {
        this.customExport = customExport;
    }

    public setExportRoundNumber(newRoundNumber: number): void {
        this.exportRoundNumber = newRoundNumber;
    }

    public setHideNewGame(value: boolean): void {
        this.hideNewGame = value;
    }

    public setImportGameStatus(status: IStatus): void {
        this.importGameStatus = status;
    }

    public setIsEditingCycleIndex(isEditingCycleIndex: boolean): void {
        this.isEditingCycleIndex = isEditingCycleIndex;
    }

    public setPacketFilename(name: string): void {
        this.packetFilename = name;
    }

    public setPendingFontFamily(font: string): void {
        this.pendingFontFamily = font;
    }

    public setPendingFontSize(size: number): void {
        this.pendingFontSize = size;
    }

    public setPacketStatus(packetStatus: IStatus): void {
        this.packetParseStatus = packetStatus;
    }

    public setPendingBonusProtest(teamName: string, questionIndex: number, part: number): void {
        this.pendingBonusProtestEvent = {
            partIndex: part,
            questionIndex,
            givenAnswer: "",
            reason: "",
            teamName,
        };
    }

    public setPendingTossupProtest(teamName: string, questionIndex: number, position: number): void {
        this.pendingTossupProtestEvent = {
            position,
            questionIndex,
            givenAnswer: "",
            reason: "",
            teamName,
        };
    }

    public setQuestionFontSize(size: number): void {
        this.questionFontSize = size;
    }

    public setSelectedWordIndex(newIndex: number): void {
        this.selectedWordIndex = newIndex;
    }

    public setYappServiceUrl(url: string | undefined): void {
        this.yappServiceUrl = url;
    }

    public toggleClockVisibility(): void {
        this.isClockHidden = !this.isClockHidden;
    }

    public toggleEventLogVisibility(): void {
        this.isEventLogHidden = !this.isEventLogHidden;
    }

    public toggleDarkMode(): void {
        this.useDarkMode = !this.useDarkMode;
    }

    public hideBuzzMenu(): void {
        this.buzzMenuState.visible = false;
    }

    public resetCustomExport(): void {
        this.customExport = undefined;
    }

    public resetFontFamily(): void {
        this.fontFamily = DefaultFontFamily;
    }

    public resetPacketFilename(): void {
        this.packetFilename = undefined;
    }

    public resetPendingBonusProtest(): void {
        this.pendingBonusProtestEvent = undefined;
    }

    public resetPendingNewGame(): void {
        this.packetParseStatus = undefined;
        this.importGameStatus = undefined;
        if (this.pendingNewGame != undefined) {
            // Clear everything but the game format and info derived from the roster URL
            this.pendingNewGame.packet = new PacketState();

            switch (this.pendingNewGame.type) {
                case PendingGameType.Manual:
                    this.pendingNewGame.cycles = undefined;
                    this.pendingNewGame.firstTeamPlayers = [];
                    this.pendingNewGame.secondTeamPlayers = [];
                    break;
                case undefined:
                case PendingGameType.Lifsheets:
                case PendingGameType.TJSheets:
                case PendingGameType.UCSDSheets:
                    // Don't clear the sheets URL or the players
                    break;
                default:
                    assertNever(this.pendingNewGame);
            }
        }
    }

    public resetPendingNewPlayer(): void {
        this.pendingNewPlayer = undefined;
    }

    public resetPendingFonts(): void {
        this.pendingFontFamily = undefined;
        this.pendingFontSize = undefined;
    }

    public resetPendingSheet(): void {
        this.pendingSheet = undefined;
    }

    public resetPendingTossupProtest(): void {
        this.pendingTossupProtestEvent = undefined;
    }

    public resetSheetsId(): void {
        this.sheetsState.sheetId = undefined;
        this.sheetsState.sheetType = undefined;
    }

    public showBuzzMenu(clearSelectedWordOnClose: boolean): void {
        this.buzzMenuState.visible = true;
        this.buzzMenuState.clearSelectedWordOnClose = clearSelectedWordOnClose;
    }

    public updatePendingProtestGivenAnswer(givenAnswer: string): void {
        if (this.pendingBonusProtestEvent != undefined) {
            this.pendingBonusProtestEvent.givenAnswer = givenAnswer;
        } else if (this.pendingTossupProtestEvent != undefined) {
            this.pendingTossupProtestEvent.givenAnswer = givenAnswer;
        }
    }

    public updatePendingProtestReason(reason: string): void {
        if (this.pendingBonusProtestEvent != undefined) {
            this.pendingBonusProtestEvent.reason = reason;
        } else if (this.pendingTossupProtestEvent != undefined) {
            this.pendingTossupProtestEvent.reason = reason;
        }
    }

    public updatePendingBonusProtestPart(part: string | number): void {
        if (this.pendingBonusProtestEvent != undefined) {
            const partIndex = typeof part === "string" ? parseInt(part, 10) : part;
            this.pendingBonusProtestEvent.partIndex = partIndex;
        }
    }

    public updatePendingNewPlayerName(name: string): void {
        if (this.pendingNewPlayer == undefined) {
            return;
        }

        this.pendingNewPlayer.name = name;
    }

    public updatePendingNewPlayerTeamName(teamName: string): void {
        if (this.pendingNewPlayer == undefined) {
            return;
        }

        this.pendingNewPlayer.teamName = teamName;
    }

    public updatePendingSheetRoundNumber(roundNumber: number): void {
        if (this.pendingSheet == undefined) {
            return;
        }

        this.pendingSheet.roundNumber = roundNumber;
    }

    public updatePendingSheetId(sheetId: string): void {
        if (this.pendingSheet == undefined) {
            return;
        }

        this.pendingSheet.sheetId = sheetId;
    }
}
