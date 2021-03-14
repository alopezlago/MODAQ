import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";
import { assertNever } from "office-ui-fabric-react";

import { ITossupProtestEvent, IBonusProtestEvent } from "./Events";
import { IPendingNewGame, PendingGameType } from "./IPendingNewGame";
import { PacketState } from "./PacketState";
import { Player } from "./TeamState";
import { LoadingState, SheetState } from "./SheetState";
import { IStatus } from "../IStatus";
import { IPendingSheet } from "./IPendingSheet";
import { Cycle } from "./Cycle";

export class UIState {
    // TODO: Should we also include the Cycle? This would simplify anything that needs access to the cycle
    public cycleIndex: number;

    @ignore
    public isEditingCycleIndex: boolean;

    @ignore
    public selectedWordIndex: number;

    @ignore
    public buzzMenuVisible: boolean;

    @ignore
    public exportToJsonDialogVisible: boolean;

    @ignore
    public importGameStatus: IStatus | undefined;

    @ignore
    public importGameDialogVisible: boolean;

    @ignore
    public newGameDialogVisible: boolean;

    @ignore
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
    public pendingSheet?: IPendingSheet;

    @ignore
    public pendingTossupProtestEvent?: ITossupProtestEvent;

    public sheetsState: SheetState;

    constructor() {
        makeAutoObservable(this);

        this.cycleIndex = 0;
        this.isEditingCycleIndex = false;
        this.selectedWordIndex = -1;
        this.buzzMenuVisible = false;
        this.exportToJsonDialogVisible = false;
        this.importGameStatus = undefined;
        this.importGameDialogVisible = false;
        this.newGameDialogVisible = false;
        this.packetFilename = undefined;
        this.packetParseStatus = undefined;
        this.pendingBonusProtestEvent = undefined;
        this.pendingNewGame = undefined;
        this.pendingNewPlayer = undefined;
        this.pendingSheet = undefined;
        this.pendingTossupProtestEvent = undefined;
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

        this.pendingNewGame = {
            packet: new PacketState(),
            firstTeamPlayers,
            secondTeamPlayers,
            type: PendingGameType.Manual,
        };
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

    public setImportGameStatus(status: IStatus): void {
        this.importGameStatus = status;
    }

    public setIsEditingCycleIndex(isEditingCycleIndex: boolean): void {
        this.isEditingCycleIndex = isEditingCycleIndex;
    }

    public setPacketFilename(name: string): void {
        this.packetFilename = name;
    }

    public setPacketStatus(packetStatus: IStatus): void {
        this.packetParseStatus = packetStatus;
    }

    public setPendingBonusProtest(teamName: string, questionIndex: number, part: number): void {
        this.pendingBonusProtestEvent = {
            partIndex: part,
            questionIndex,
            reason: "",
            teamName,
        };
    }

    public setPendingTossupProtest(teamName: string, questionIndex: number, position: number): void {
        this.pendingTossupProtestEvent = {
            position,
            questionIndex,
            reason: "",
            teamName,
        };
    }

    public setSheetsApiInitialized(state: LoadingState): void {
        this.sheetsState.apiInitialized = state;
    }

    public setSheetsId(id: string): void {
        this.sheetsState.sheetId = id;
    }

    public setSelectedWordIndex(newIndex: number): void {
        this.selectedWordIndex = newIndex;
    }

    public hideBuzzMenu(): void {
        this.buzzMenuVisible = false;
    }

    public hideExportToJsonDialog(): void {
        this.exportToJsonDialogVisible = false;
    }

    public hideImportGameDialog(): void {
        this.importGameDialogVisible = false;
    }

    public hideNewGameDialog(): void {
        this.newGameDialogVisible = false;
    }

    public resetPacketFilename(): void {
        this.packetFilename = undefined;
    }

    public resetPendingBonusProtest(): void {
        this.pendingBonusProtestEvent = undefined;
    }

    public resetPendingNewGame(): void {
        this.pendingNewGame = undefined;
        this.packetParseStatus = undefined;
        this.importGameStatus = undefined;
    }

    public resetPendingNewPlayer(): void {
        this.pendingNewPlayer = undefined;
    }

    public resetPendingSheet(): void {
        this.pendingSheet = undefined;
    }

    public resetPendingTossupProtest(): void {
        this.pendingTossupProtestEvent = undefined;
    }

    public resetSheetsId(): void {
        this.sheetsState.sheetId = undefined;
    }

    public showBuzzMenu(): void {
        this.buzzMenuVisible = true;
    }

    public showExportToJsonDialog(): void {
        this.exportToJsonDialogVisible = true;
    }

    public showImportGameDialog(): void {
        this.importGameDialogVisible = true;
    }

    public showNewGameDialog(): void {
        this.newGameDialogVisible = true;
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
