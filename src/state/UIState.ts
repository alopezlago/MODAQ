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

// How many blank competitor entries an individual game starts with. IPNCT rooms typically hold eight to ten
// players, and the reader can add more (up to the format's maximum) or leave the extras blank.
const defaultIndividualPlayerCount = 8;

export class UIState {
    @ignore
    public buildVersion: string | undefined;

    // The player the host's buzzer says is answering right now (Klaxon's
    // latency-fair winner, linked to a MODAQ player). Purely a convenience for
    // the buzz menu, which lists them first; the full roster stays listed.
    @ignore
    public buzzedInPlayer: { name: string; teamName: string } | undefined;

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

    // When true, listen to the microphone and move the buzz point as the reader reads the tossup
    public trackReaderWithMicrophone: boolean;

    // When true, microphone tracking doesn't move the highlight on its own; it stays put until the user presses
    // B, which jumps it to where the reader currently is. The live position is still tracked in the background.
    public holdReaderHighlightUntilBuzz: boolean;

    // When true, microphone tracking moves the highlight to the reader's position immediately, instead of
    // waiting for the reading to pause. More responsive, but the highlight jitters with the recognizer's bursts.
    // Has no effect when holdReaderHighlightUntilBuzz is on (the highlight is held until B regardless).
    public instantReaderHighlight: boolean;

    // Words to offset the buzz point from the reader's detected position when pressing Space (-4 to +4). Lets
    // the user compensate for recognition lag/lead so the buzz lands on the right word. 0 means no offset.
    public buzzPointWordOffset: number;

    // When true, pressing Space shows a number above each word and the user types a word's number (then Enter)
    // to set the buzz point there, instead of opening the buzz menu at the detected position right away.
    public typeBuzzIndexMode: boolean;

    // When true, the space above the words that the numbers use isn't held open while reading, so the question
    // keeps its normal line spacing. The numbers still appear when the moderator presses Space, but showing them
    // shifts the text down, which is what reserving the space avoids.
    public collapseBuzzIndexSpacing: boolean;

    // When true, YAPP2 pronunciation anchors (the <pg>-tagged words a guide is coming for) are drawn like any
    // other word, instead of being colored maroon. The guides themselves still read as usual.
    public hidePronunciationAnchors: boolean;

    // When true, the reader sees one question at a time -- the tossup, then its bonus only if the tossup was
    // converted -- instead of the tossup and bonus together. Previous/Next walk that reading order.
    public oneQuestionAtATime: boolean;

    // In that mode, whether the current step is the cycle's bonus rather than its tossup. Meaningless when the
    // cycle has no bonus to read, so read it through CycleChooserController rather than on its own.
    public showingBonus: boolean;

    // When true, microphone tracking transcribes with OpenAI's Whisper running in the browser (transformers.js)
    // instead of the Web Speech API / Vosk. More accurate, fully on-device, but heavier (model download) and
    // slower, and not streaming. Requires reloading the tossup (toggling mic tracking) to take effect.
    public useWhisperWebEngine: boolean;

    // Whether we're currently waiting for the user to type a word number (after pressing Space in the mode above)
    @ignore
    public isEnteringBuzzIndex: boolean;

    // Whether the numbers above the words are showing. They only appear once the moderator presses Space, and
    // stay up through the buzz menu that word-number entry opens, so the numbers aren't a constant distraction
    // while reading.
    @ignore
    public buzzIndexesVisible: boolean;

    // The digits typed so far while entering a word number
    @ignore
    public buzzIndexEntryValue: string;

    // When true, show diagnostics for the microphone tracking (engine, status, last heard words). On by default
    // while the feature is being tuned.
    @ignore
    public showReaderFollowerDebug: boolean;

    @ignore
    public readerFollowerEngine: string | undefined;

    @ignore
    public readerFollowerStatus: string | undefined;

    @ignore
    public readerFollowerTranscript: string | undefined;

    // Where the reader currently is, before the pause delay moves the buzz point there
    @ignore
    public readerFollowerLivePosition: number;

    // The last event that made the buzz point update immediately (buzz sound, "correct"/"incorrect"/etc.)
    @ignore
    public readerFollowerLastCue: string | undefined;

    // When the mouse last moved over the question text. Used to decide if the user is picking a buzz point
    // manually (so keyboard shortcuts shouldn't move it) or relying on the microphone tracking.
    @ignore
    public lastQuestionTextMouseMoveTime: number;

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
            selectedPlayerIndex: undefined,
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
        this.pendingSheet = undefined;
        this.pendingTossupProtestEvent = undefined;
        this.trackReaderWithMicrophone = false;
        this.holdReaderHighlightUntilBuzz = false;
        this.instantReaderHighlight = false;
        this.buzzPointWordOffset = 0;
        this.typeBuzzIndexMode = false;
        this.collapseBuzzIndexSpacing = false;
        this.hidePronunciationAnchors = false;
        this.oneQuestionAtATime = false;
        this.showingBonus = false;
        this.isEnteringBuzzIndex = false;
        this.buzzIndexesVisible = false;
        this.buzzIndexEntryValue = "";
        this.useWhisperWebEngine = false;
        this.showReaderFollowerDebug = true;
        this.readerFollowerEngine = undefined;
        this.readerFollowerStatus = undefined;
        this.readerFollowerTranscript = undefined;
        this.readerFollowerLivePosition = -1;
        this.readerFollowerLastCue = undefined;
        this.lastQuestionTextMouseMoveTime = 0;
        this.useDarkMode = false;
        this.yappServiceUrl = undefined;

        // These are defined by the theme if not set explicitly
        this.pronunciationGuideColor = undefined;
        this.questionFontColor = undefined;
        // The default font size is 16px
        this.questionFontSize = 16;
        this.sheetsState = new SheetState();
    }

    // Individual games start with the smallest roster the rules allow, and the reader adds the rest
    private static createIndividualPlayers(): Player[] {
        const players: Player[] = [];
        for (let i = 0; i < defaultIndividualPlayerCount; i++) {
            players.push(new Player("", "", /* isStarter */ true));
        }

        return players;
    }

    // Replace both manual rosters at once, for a host that already knows the teams (see ModaqControl's
    // newGameOnLoad.teams). Creates the pending game if there isn't one, so it can be called before the dialog opens.
    public setPendingNewGameManualTeams(firstTeamPlayers: Player[], secondTeamPlayers: Player[]): void {
        if (this.pendingNewGame == undefined) {
            this.createPendingNewGame();
        }
        if (this.pendingNewGame?.type !== PendingGameType.Manual) {
            return;
        }
        this.pendingNewGame.manual.firstTeamPlayers = firstTeamPlayers;
        this.pendingNewGame.manual.secondTeamPlayers = secondTeamPlayers;
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

    // Each competitor in an individual game is their own one-player team, so their team name follows their name
    public addIndividualPlayerToPendingNewGame(): void {
        if (this.pendingNewGame?.type !== PendingGameType.Manual) {
            return;
        }

        const individualPlayers: Player[] = this.pendingNewGame.manual.individualPlayers;
        if (individualPlayers.length >= GameFormats.getMaximumTeamCount(this.pendingNewGame.gameFormat)) {
            return;
        }

        individualPlayers.push(new Player("", "", /* isStarter */ true));
    }

    public removeIndividualPlayerFromPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.manual.individualPlayers = this.pendingNewGame.manual.individualPlayers.filter(
                (p) => p !== player
            );
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
                    individualPlayers: UIState.createIndividualPlayers(),
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
                            // Older persisted pending games predate individual formats
                            individualPlayers:
                                this.pendingNewGame.manual.individualPlayers ?? UIState.createIndividualPlayers(),
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

    public setPendingNewGamePacket(packet: PacketState): void {
        if (this.pendingNewGame == undefined) {
            return;
        }

        this.pendingNewGame.packet = packet;
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

    // Adds or removes a roster player from an individual game's field. Competitors play for themselves, so the
    // player is copied with their own name as their team name rather than the school they registered under.
    public toggleRegistrationIndividualPlayer(player: Player): void {
        if (this.pendingNewGame?.type !== PendingGameType.QBJRegistration) {
            return;
        }

        const registration = this.pendingNewGame.registration;
        const selected: Player[] = registration.individualPlayers ?? [];
        const existing: Player | undefined = selected.find((p) => p.name === player.name);

        if (existing != undefined) {
            registration.individualPlayers = selected.filter((p) => p !== existing);
            return;
        }

        if (selected.length >= GameFormats.getMaximumTeamCount(this.pendingNewGame.gameFormat)) {
            return;
        }

        registration.individualPlayers = selected.concat(
            new Player(player.name, player.name, /* isStarter */ true)
        );
    }

    // Sets the competitors of an individual game, where each player is their own one-player team
    public setPendingNewGameIndividualPlayers(players: Player[]): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.manual.individualPlayers = players;
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

            // Every way of changing questions lands on that question's tossup; the bonus step is only reached by
            // going forward through it (see CycleChooserController)
            this.showingBonus = false;

            // Clear the selected words, since it's not relevant to the next question
            this.selectedWordIndex = -1;

            // Any in-progress word-number entry belongs to the previous question
            this.endBuzzIndexEntry();
            this.hideBuzzIndexes();
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

    public setBuzzedInPlayer(player: { name: string; teamName: string } | undefined): void {
        this.buzzedInPlayer = player;
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

    public showRemoveTossupProtestDialog(cycle: Cycle, teamName: string): void {
        const existingProtest: ITossupProtestEvent | undefined = cycle.tossupProtests?.find(
            (protest) => protest.teamName === teamName
        );
        if (existingProtest == undefined) {
            return;
        }

        this.dialogState.showYesNoCancelMessageDialog({
            title: "Remove protest",
            message: `Do you want to remove or edit the tossup protest for "${teamName}"?`,
            yesLabel: "Remove",
            noLabel: "Edit",
            onYes: () => {
                cycle.removeTossupProtest(teamName);
            },
            onNo: () => {
                this.setPendingTossupProtest(teamName, existingProtest.questionIndex, existingProtest.position);

                if (this.pendingTossupProtestEvent != undefined) {
                    this.pendingTossupProtestEvent.givenAnswer = existingProtest.givenAnswer ?? "";
                    this.pendingTossupProtestEvent.reason = existingProtest.reason;
                }
            },
        });
    }

    public showRemoveBonusProtestDialog(cycle: Cycle, partIndex: number): void {
        const existingProtest: IBonusProtestEvent | undefined = cycle.bonusProtests?.find(
            (protest) => protest.partIndex === partIndex
        );
        if (existingProtest == undefined) {
            return;
        }

        this.dialogState.showYesNoCancelMessageDialog({
            title: "Remove protest",
            message: `Do you want to remove or edit the bonus protest for part ${partIndex + 1}?`,
            yesLabel: "Remove",
            noLabel: "Edit",
            onYes: () => {
                cycle.removeBonusProtest(partIndex);
            },
            onNo: () => {
                this.setPendingBonusProtest(existingProtest.teamName, existingProtest.questionIndex, partIndex);

                if (this.pendingBonusProtestEvent != undefined) {
                    this.pendingBonusProtestEvent.givenAnswer = existingProtest.givenAnswer ?? "";
                    this.pendingBonusProtestEvent.reason = existingProtest.reason;
                }
            },
        });
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

    public toggleHoldReaderHighlightUntilBuzz(): void {
        this.holdReaderHighlightUntilBuzz = !this.holdReaderHighlightUntilBuzz;
    }

    public toggleInstantReaderHighlight(): void {
        this.instantReaderHighlight = !this.instantReaderHighlight;
    }

    public setBuzzPointWordOffset(offset: number): void {
        // Clamp to the supported range so a bad stored value can't push the buzz point wildly off
        this.buzzPointWordOffset = Math.max(-4, Math.min(4, Math.round(offset)));
    }

    public toggleTypeBuzzIndexMode(): void {
        this.typeBuzzIndexMode = !this.typeBuzzIndexMode;
        // Don't leave a half-finished entry around if the mode is turned off mid-entry
        if (!this.typeBuzzIndexMode) {
            this.endBuzzIndexEntry();
            this.hideBuzzIndexes();
        }
    }

    public toggleCollapseBuzzIndexSpacing(): void {
        this.collapseBuzzIndexSpacing = !this.collapseBuzzIndexSpacing;
    }

    public togglePronunciationAnchors(): void {
        this.hidePronunciationAnchors = !this.hidePronunciationAnchors;
    }

    public toggleOneQuestionAtATime(): void {
        this.oneQuestionAtATime = !this.oneQuestionAtATime;

        // Leaving the mode shows both questions again, so the bonus step doesn't outlive it
        if (!this.oneQuestionAtATime) {
            this.showingBonus = false;
        }
    }

    public setShowingBonus(showingBonus: boolean): void {
        this.showingBonus = showingBonus;
    }

    public toggleUseWhisperWebEngine(): void {
        this.useWhisperWebEngine = !this.useWhisperWebEngine;
    }

    public startBuzzIndexEntry(): void {
        this.isEnteringBuzzIndex = true;
        this.buzzIndexesVisible = true;
        this.buzzIndexEntryValue = "";
    }

    // Hides the numbers above the words. Entry ending doesn't hide them on its own, since committing a number
    // opens the buzz menu and the numbers should stay up until that menu closes.
    public hideBuzzIndexes(): void {
        this.buzzIndexesVisible = false;
    }

    public setBuzzIndexEntryValue(value: string): void {
        this.buzzIndexEntryValue = value;
    }

    public endBuzzIndexEntry(): void {
        this.isEnteringBuzzIndex = false;
        this.buzzIndexEntryValue = "";
    }

    public setTrackReaderWithMicrophone(value: boolean): void {
        this.trackReaderWithMicrophone = value;

        if (!value) {
            this.readerFollowerEngine = undefined;
            this.readerFollowerStatus = undefined;
            this.readerFollowerTranscript = undefined;
            this.readerFollowerLivePosition = -1;
            this.readerFollowerLastCue = undefined;
        }
    }

    public setReaderFollowerLivePosition(position: number): void {
        this.readerFollowerLivePosition = position;
    }

    public setReaderFollowerLastCue(cue: string): void {
        this.readerFollowerLastCue = cue;
    }

    public setLastQuestionTextMouseMoveTime(time: number): void {
        // Mouse move events fire constantly while the mouse is over the text; only record one every so often
        if (time - this.lastQuestionTextMouseMoveTime >= 250) {
            this.lastQuestionTextMouseMoveTime = time;
        }
    }

    public setReaderFollowerStatus(engine: string, status: string): void {
        this.readerFollowerEngine = engine;
        this.readerFollowerStatus = status;
    }

    public setReaderFollowerTranscript(transcript: string): void {
        this.readerFollowerTranscript = transcript;
    }

    public toggleReaderFollowerDebug(): void {
        this.showReaderFollowerDebug = !this.showReaderFollowerDebug;
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
        this.buzzMenuState.selectedPlayerIndex = undefined;

        // The buzz is marked (or the menu was dismissed), so the word numbers have done their job
        this.hideBuzzIndexes();
    }

    public setBuzzMenuSelectedPlayerIndex(index: number | undefined): void {
        this.buzzMenuState.selectedPlayerIndex = index;
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
        this.buzzMenuState.selectedPlayerIndex = undefined;
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
