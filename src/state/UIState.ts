import { assertNever } from "@fluentui/react";
import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";

import * as GameFormats from "./GameFormats";
import { ITossupProtestEvent, IBonusProtestEvent } from "./Events";
import {
    IPendingFromSheetsNewGameState,
    IPendingNewGame,
    IPendingQBJRegistrationNewGameState,
    PendingGameType,
} from "./IPendingNewGame";
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
import { ModalVisibilityStatus } from "./ModalVisibilityStatus";
import { IPacketParseStatus } from "./IPacketParseStatus";

// TODO: Look into breaking this up into individual UI component states. Lots of pendingX fields, which could be in
// their own (see CustomizeGameFormatDialogState)
// Alternatively, keep certain component-local states in the component state, and only store values that could be used
// outside of that component here.

const DefaultFontFamily = "Times New Roman, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, serif";

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
    public customExportOptions: ICustomExport | undefined;

    @ignore
    public customExportIntervalId: number | undefined;

    @ignore
    public customExportStatus: string | undefined;

    @ignore
    public exportRoundNumber: number;

    // Default should be to always show bonuses. This setting didn't exist before, so use hide instead of show
    public hideBonusOnDeadTossup: boolean;

    @ignore
    public hideNewGame: boolean;

    @ignore
    public importGameStatus: IStatus | undefined;

    public packetFilename: string | undefined;

    @ignore
    public packetParseStatus: IPacketParseStatus | undefined;

    @ignore
    public pendingBonusProtestEvent?: IBonusProtestEvent;

    @ignore
    public pendingNewGame?: IPendingNewGame;

    @ignore
    public pendingNewPlayer?: Player;

    @ignore
    public pendingSheet?: IPendingSheet;

    @ignore
    public pendingTossupProtestEvent?: ITossupProtestEvent;

    // Default should be to show the clock. This setting didn't exist before, so use hide instead of show
    public isClockHidden: boolean;

    // Default should be to show the event log. This setting didn't exist before, so use hide instead of show
    public isEventLogHidden: boolean;

    // Default should be to show the export status. This setting didn't exist before, so use hide instead of show
    public isCustomExportStatusHidden: boolean;

    // Default should be to show the packet name. This setting didn't exist before, so use hide instead of show
    public isPacketNameHidden: boolean;

    // Default should be to have it horizontal.
    public isScoreVertical: boolean;

    // Default should be to highlight answered bonuses
    public noBonusHighlight: boolean;

    public pronunciationGuideColor: string | undefined;

    public questionFontColor: string | undefined;

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
        this.customExportOptions = undefined;
        this.customExportIntervalId = undefined;
        this.customExportStatus = undefined;
        this.exportRoundNumber = 1;
        this.hideBonusOnDeadTossup = false;
        this.hideNewGame = false;

        // Default to Fabric UI's default font (Segoe UI), then Times New Roman
        this.fontFamily = DefaultFontFamily;

        this.isClockHidden = false;
        this.isEventLogHidden = false;
        this.isPacketNameHidden = false;
        this.isCustomExportStatusHidden = false;
        this.isScoreVertical = false;
        this.importGameStatus = undefined;
        this.noBonusHighlight = false;
        this.packetFilename = undefined;
        this.packetParseStatus = undefined;
        this.pendingBonusProtestEvent = undefined;
        this.pendingNewGame = undefined;
        this.pendingNewPlayer = undefined;
        this.pendingSheet = undefined;
        this.pendingTossupProtestEvent = undefined;
        this.useDarkMode = false;
        this.yappServiceUrl = undefined;

        // These are defined by the theme if not set explicitly
        this.pronunciationGuideColor = undefined;
        this.questionFontColor = undefined;
        // The default font size is 16px
        this.questionFontSize = 16;
        this.sheetsState = new SheetState();
    }

    // TODO: Feels off. Could generalize to array of teams
    public addPlayerToFirstTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.manual.firstTeamPlayers.push(player);
        }
    }

    public addPlayerToSecondTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.manual.secondTeamPlayers.push(player);
        }
    }

    public clearPacketStatus(): void {
        this.packetParseStatus = undefined;
    }

    public clearPendingNewGameRegistrationStatus(): void {
        if (this.pendingNewGame?.type !== PendingGameType.QBJRegistration) {
            return;
        }

        this.pendingNewGame.registration.errorMessage = undefined;
    }

    public createPendingNewGame(): void {
        if (this.pendingNewGame == undefined) {
            const firstTeamPlayers: Player[] = [];
            const secondTeamPlayers: Player[] = [];
            for (let i = 0; i < 4; i++) {
                firstTeamPlayers.push(new Player("", "Team 1", /* isStarter */ true));
                secondTeamPlayers.push(new Player("", "Team 2", /* isStarter */ true));
            }

            this.pendingNewGame = {
                packet: new PacketState(),
                type: PendingGameType.Manual,
                gameFormat: GameFormats.StandardPowersMACFGameFormat,
                manual: {
                    firstTeamPlayers,
                    secondTeamPlayers,
                },
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
                        manual: {
                            ...this.pendingNewGame.manual,
                            cycles: undefined,
                        },
                    };

                    break;
                case PendingGameType.QBJRegistration:
                    this.pendingNewGame = {
                        ...this.pendingNewGame,
                        registration: {
                            ...this.pendingNewGame.registration,
                            cycles: undefined,
                        },
                    };
                    break;
                case PendingGameType.TJSheets:
                    this.pendingNewGame = {
                        ...this.pendingNewGame,
                        tjSheets: {
                            ...this.pendingNewGame.tjSheets,
                        },
                    };
                    break;
                case PendingGameType.UCSDSheets:
                    this.pendingNewGame = {
                        ...this.pendingNewGame,
                        ucsdSheets: {
                            ...this.pendingNewGame.ucsdSheets,
                        },
                    };
                    break;
                default:
                    assertNever(this.pendingNewGame);
            }
        }
    }

    public createPendingNewPlayer(teamName: string): void {
        this.pendingNewPlayer = new Player("", teamName, /* isStarter */ false);
        this.dialogState.visibleDialog = ModalVisibilityStatus.AddPlayer;
    }

    public createPendingSheet(): void {
        this.pendingSheet = {
            roundNumber: this.sheetsState.roundNumber ?? 1,
            sheetId: this.sheetsState.sheetId ?? "",
        };
        this.dialogState.visibleDialog = ModalVisibilityStatus.ExportToSheets;
    }

    public removePlayerToFirstTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.manual.firstTeamPlayers = this.pendingNewGame.manual.firstTeamPlayers.filter(
                (p) => p !== player
            );
        }
    }

    public removePlayerToSecondTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.manual.secondTeamPlayers = this.pendingNewGame.manual.secondTeamPlayers.filter(
                (p) => p !== player
            );
        }
    }

    public setFontFamily(listedFont: string): void {
        // It's possible the listed font has default fonts listed too. Cut them out so that we don't keep compounding
        // the default fonts on top.
        const commaIndex: number = listedFont.indexOf(",");
        if (commaIndex >= 0) {
            listedFont = listedFont.substring(0, commaIndex);
        }

        this.fontFamily = listedFont + ", " + DefaultFontFamily;
    }

    public setPendingNewGameType(type: PendingGameType): void {
        if (this.pendingNewGame != undefined) {
            this.pendingNewGame.type = type;
            if (
                this.pendingNewGame.type === PendingGameType.QBJRegistration &&
                this.pendingNewGame.registration == undefined
            ) {
                this.pendingNewGame.registration = {
                    firstTeamPlayers: undefined,
                    players: [],
                    secondTeamPlayers: undefined,
                };
            } else if (
                this.pendingNewGame.type === PendingGameType.TJSheets &&
                this.pendingNewGame.tjSheets == undefined
            ) {
                this.pendingNewGame.tjSheets = {
                    firstTeamPlayersFromRosters: undefined,
                    playersFromRosters: undefined,
                    rostersUrl: undefined,
                    secondTeamPlayersFromRosters: undefined,
                };
            } else if (
                this.pendingNewGame.type === PendingGameType.UCSDSheets &&
                this.pendingNewGame.ucsdSheets == undefined
            ) {
                this.pendingNewGame.ucsdSheets = {
                    firstTeamPlayersFromRosters: undefined,
                    playersFromRosters: undefined,
                    rostersUrl: undefined,
                    secondTeamPlayersFromRosters: undefined,
                };
            }
        }
    }

    public setPendingNewGameCycles(cycles: Cycle[]): void {
        if (this.pendingNewGame == undefined) {
            return;
        }

        if (this.pendingNewGame.type === PendingGameType.Manual) {
            this.pendingNewGame.manual.cycles = cycles;
        } else if (this.pendingNewGame.type === PendingGameType.QBJRegistration) {
            this.pendingNewGame.registration.cycles = cycles;
        }
    }

    public setPendingNewGameFormat(gameFormat: IGameFormat): void {
        if (this.pendingNewGame == undefined) {
            return;
        }

        this.pendingNewGame.gameFormat = gameFormat;
    }

    public setPendingNewGameRegistrationErrorMessage(message: string): void {
        if (this.pendingNewGame?.type !== PendingGameType.QBJRegistration) {
            return;
        }

        this.pendingNewGame.registration.errorMessage = message;
    }

    public setPendingNewGameRosters(players: Player[]): void {
        if (this.pendingNewGame?.type == undefined) {
            return;
        }

        if (this.pendingNewGame.type === PendingGameType.QBJRegistration) {
            const registration: IPendingQBJRegistrationNewGameState = this.pendingNewGame.registration;
            registration.players = players;

            registration.firstTeamPlayers = [];
            registration.secondTeamPlayers = [];

            if (players.length < 2) {
                return;
            }

            const firstTeam: string = players[0].teamName;
            const secondTeam: string = players.find((player) => player.teamName !== firstTeam)?.teamName ?? firstTeam;
            if (firstTeam === secondTeam) {
                // Handle the unapproved case of one team only gracefully by having both teams refer to the same one
                registration.firstTeamPlayers = players;
                registration.secondTeamPlayers = players;
                return;
            }

            for (const player of players) {
                if (player.teamName === firstTeam) {
                    registration.firstTeamPlayers.push(player);
                } else if (player.teamName === secondTeam) {
                    registration.secondTeamPlayers.push(player);
                }
            }

            return;
        }

        if (this.pendingNewGame.type !== PendingGameType.Manual) {
            const sheetsState: IPendingFromSheetsNewGameState =
                this.pendingNewGame.type === PendingGameType.TJSheets
                    ? this.pendingNewGame.tjSheets
                    : this.pendingNewGame.ucsdSheets;
            sheetsState.playersFromRosters = players;
            sheetsState.firstTeamPlayersFromRosters = [];
            sheetsState.secondTeamPlayersFromRosters = [];
        }
    }

    public setPendingNewGameRostersUrl(url: string): void {
        if (this.pendingNewGame?.type == undefined) {
            return;
        }

        if (this.pendingNewGame.type === PendingGameType.TJSheets) {
            this.pendingNewGame.tjSheets.rostersUrl = url;
        } else if (this.pendingNewGame.type === PendingGameType.UCSDSheets) {
            this.pendingNewGame.ucsdSheets.rostersUrl = url;
        }
    }

    public setPendingNewGameFirstTeamPlayers(players: Player[]): void {
        if (this.pendingNewGame?.type == undefined) {
            return;
        }

        switch (this.pendingNewGame.type) {
            case PendingGameType.TJSheets:
                this.pendingNewGame.tjSheets.firstTeamPlayersFromRosters = players;
                break;
            case PendingGameType.UCSDSheets:
                this.pendingNewGame.ucsdSheets.firstTeamPlayersFromRosters = players;
                break;
            case PendingGameType.Manual:
                this.pendingNewGame.manual.firstTeamPlayers = players;
                break;
            case PendingGameType.QBJRegistration:
                this.pendingNewGame.registration.firstTeamPlayers = players;
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
            case PendingGameType.TJSheets:
                this.pendingNewGame.tjSheets.secondTeamPlayersFromRosters = players;
                break;
            case PendingGameType.UCSDSheets:
                this.pendingNewGame.ucsdSheets.secondTeamPlayersFromRosters = players;
                break;
            case PendingGameType.Manual:
                this.pendingNewGame.manual.secondTeamPlayers = players;
                break;
            case PendingGameType.QBJRegistration:
                this.pendingNewGame.registration.secondTeamPlayers = players;
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
        this.customExportOptions = customExport;
    }

    public setCustomExportIntervalId(intervalId: number | undefined): void {
        this.customExportIntervalId = intervalId;
    }

    public setCustomExportStatus(status: string | undefined): void {
        this.customExportStatus = status;
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

    public setPacketStatus(packetStatus: IStatus, warnings?: string[]): void {
        this.packetParseStatus = {
            status: packetStatus,
            warnings: warnings ?? [],
        };
    }

    public setPendingBonusProtest(teamName: string, questionIndex: number, part: number): void {
        this.pendingBonusProtestEvent = {
            partIndex: part,
            questionIndex,
            givenAnswer: "",
            reason: "",
            teamName,
        };
        this.dialogState.visibleDialog = ModalVisibilityStatus.BonusProtest;
    }

    public setPendingTossupProtest(teamName: string, questionIndex: number, position: number): void {
        this.pendingTossupProtestEvent = {
            position,
            questionIndex,
            givenAnswer: "",
            reason: "",
            teamName,
        };
        this.dialogState.visibleDialog = ModalVisibilityStatus.TossupProtest;
    }

    public setPronunciationGuideColor(color: string | undefined): void {
        this.pronunciationGuideColor = color;
    }

    public setQuestionFontColor(color: string | undefined): void {
        this.questionFontColor = color;
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

    public toggleBonusHighlight(): void {
        this.noBonusHighlight = !this.noBonusHighlight;
    }

    public toggleClockVisibility(): void {
        this.isClockHidden = !this.isClockHidden;
    }

    public toggleCustomExportStatusVisibility(): void {
        this.isCustomExportStatusHidden = !this.isCustomExportStatusHidden;
    }

    public toggleDarkMode(): void {
        this.useDarkMode = !this.useDarkMode;
    }

    public toggleEventLogVisibility(): void {
        this.isEventLogHidden = !this.isEventLogHidden;
    }

    public toggleHideBonusOnDeadTossup(): void {
        this.hideBonusOnDeadTossup = !this.hideBonusOnDeadTossup;
    }

    public togglePacketNameVisibility(): void {
        this.isPacketNameHidden = !this.isPacketNameHidden;
    }

    public toggleScoreVerticality(): void {
        this.isScoreVertical = !this.isScoreVertical;
    }

    public hideBuzzMenu(): void {
        this.buzzMenuState.visible = false;
    }

    public resetCustomExport(): void {
        this.customExportOptions = undefined;
    }

    public resetFontFamily(): void {
        this.fontFamily = DefaultFontFamily;
    }

    public resetPacketFilename(): void {
        this.packetFilename = undefined;
    }

    public resetPendingBonusProtest(): void {
        this.pendingBonusProtestEvent = undefined;
        this.dialogState.visibleDialog = ModalVisibilityStatus.None;
    }

    public resetPendingNewGame(): void {
        this.packetParseStatus = undefined;
        this.importGameStatus = undefined;
        if (this.pendingNewGame != undefined) {
            // Clear everything but the game format and info derived from the roster URL
            this.pendingNewGame.packet = new PacketState();

            switch (this.pendingNewGame.type) {
                case PendingGameType.Manual:
                    this.pendingNewGame.manual.cycles = undefined;
                    break;
                case PendingGameType.QBJRegistration:
                    this.pendingNewGame.registration.cycles = undefined;
                    this.clearPendingNewGameRegistrationStatus();
                    break;
                case undefined:
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
        this.dialogState.visibleDialog = ModalVisibilityStatus.None;
    }

    public resetPendingSheet(): void {
        this.pendingSheet = undefined;
        this.dialogState.visibleDialog = ModalVisibilityStatus.None;
    }

    public resetPendingTossupProtest(): void {
        this.pendingTossupProtestEvent = undefined;
        this.dialogState.visibleDialog = ModalVisibilityStatus.None;
    }

    public resetSheetsId(): void {
        this.sheetsState.sheetId = undefined;
        this.sheetsState.sheetType = undefined;
    }

    public showBuzzMenu(clearSelectedWordOnClose: boolean): void {
        this.buzzMenuState.visible = true;
        this.buzzMenuState.clearSelectedWordOnClose = clearSelectedWordOnClose;
    }

    // We have to do this call here because this is where the information is available
    public showFontDialog(): void {
        this.dialogState.showFontDialog(
            this.fontFamily,
            this.questionFontSize,
            this.questionFontColor,
            this.pronunciationGuideColor
        );
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
