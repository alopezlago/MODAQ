import { observable, action } from "mobx";
import { ignore } from "mobx-sync";

import { ITossupProtestEvent, IBonusProtestEvent } from "./Events";
import { IPendingNewGame, PendingGameType } from "./IPendingNewGame";
import { PacketState } from "./PacketState";
import { Player } from "./TeamState";
import { LoadingState, SheetState } from "./SheetState";
import { IStatus } from "../IStatus";
import { IPendingSheet } from "./IPendingSheet";

export class UIState {
    constructor() {
        this.cycleIndex = 0;
        this.isEditingCycleIndex = false;
        this.selectedWordIndex = -1;
        this.buzzMenuVisible = false;
        this.packetParseStatus = undefined;
        this.pendingBonusProtestEvent = undefined;
        this.pendingNewGame = undefined;
        this.pendingNewPlayer = undefined;
        this.pendingSheet = undefined;
        this.pendingTossupProtestEvent = undefined;
        this.sheetsState = new SheetState();
    }

    // TODO: Should we also include the Cycle? This would simplify anything that needs access to the cycle
    @observable
    public cycleIndex: number;

    @observable
    @ignore
    public isEditingCycleIndex: boolean;

    @observable
    @ignore
    public selectedWordIndex: number;

    @observable
    @ignore
    public buzzMenuVisible: boolean;

    @observable
    @ignore
    public packetParseStatus: IStatus | undefined;

    @observable
    @ignore
    public pendingBonusProtestEvent?: IBonusProtestEvent;

    @observable
    @ignore
    public pendingNewGame?: IPendingNewGame;

    @observable
    @ignore
    public pendingNewPlayer?: Player;

    @observable
    @ignore
    public pendingSheet?: IPendingSheet;

    @observable
    @ignore
    public pendingTossupProtestEvent?: ITossupProtestEvent;

    @observable
    public sheetsState: SheetState;

    // TODO: Feels off. Could generalize to array of teams
    @action
    public addPlayerToFirstTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame?.firstTeamPlayers.push(player);
        }
    }

    @action
    public addPlayerToSecondTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame?.secondTeamPlayers.push(player);
        }
    }

    @action
    public clearPacketStatus(): void {
        this.packetParseStatus = undefined;
    }

    @action
    public removePlayerToFirstTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.firstTeamPlayers = this.pendingNewGame?.firstTeamPlayers.filter((p) => p !== player);
        }
    }

    @action
    public removePlayerToSecondTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame?.type === PendingGameType.Manual) {
            this.pendingNewGame.secondTeamPlayers = this.pendingNewGame?.secondTeamPlayers.filter((p) => p !== player);
        }
    }

    @action
    public setPendingGameType(type: PendingGameType): void {
        if (this.pendingNewGame != undefined) {
            this.pendingNewGame.type = type;
        }
    }

    @action
    public setRostersForPendingGame(players: Player[]): void {
        if (this.pendingNewGame?.type === PendingGameType.LifSheets) {
            this.pendingNewGame.playersFromRosters = players;
            this.pendingNewGame.firstTeamPlayersFromRosters = [];
            this.pendingNewGame.secondTeamPlayersFromRosters = [];
        }
    }

    @action
    public setRostersUrlForPendingGame(url: string): void {
        if (this.pendingNewGame?.type === PendingGameType.LifSheets) {
            this.pendingNewGame.rostersUrl = url;
        }
    }

    @action
    public setFirstTeamPlayersFromRostersForPendingGame(players: Player[]): void {
        if (this.pendingNewGame?.type === PendingGameType.LifSheets) {
            this.pendingNewGame.firstTeamPlayersFromRosters = players;
        }
    }

    @action
    public setSecondTeamPlayersFromRostersForPendingGame(players: Player[]): void {
        if (this.pendingNewGame?.type === PendingGameType.LifSheets) {
            this.pendingNewGame.secondTeamPlayersFromRosters = players;
        }
    }

    @action
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

    @action
    public createPendingNewPlayer(teamName: string): void {
        this.pendingNewPlayer = new Player("", teamName, /* isStarter */ false);
    }

    @action
    public createPendingSheet(): void {
        this.pendingSheet = {
            roundNumber: 1,
            sheetId: "",
        };
    }

    @action
    public nextCycle(): void {
        this.setCycleIndex(this.cycleIndex + 1);
    }

    @action
    public previousCycle(): void {
        if (this.cycleIndex > 0) {
            this.setCycleIndex(this.cycleIndex - 1);
        }
    }

    @action
    public setCycleIndex(newIndex: number): void {
        if (newIndex >= 0) {
            this.cycleIndex = newIndex;

            // Clear the selected words, since it's not relevant to the next question
            this.selectedWordIndex = -1;
        }
    }

    @action
    public setIsEditingCycleIndex(isEditingCycleIndex: boolean): void {
        this.isEditingCycleIndex = isEditingCycleIndex;
    }
    @action
    public setPacketStatus(packetStatus: IStatus): void {
        this.packetParseStatus = packetStatus;
    }

    @action
    public setPendingBonusProtest(teamName: string, questionIndex: number, part: number): void {
        this.pendingBonusProtestEvent = {
            partIndex: part,
            questionIndex,
            reason: "",
            teamName,
        };
    }

    @action
    public setPendingTossupProtest(teamName: string, questionIndex: number, position: number): void {
        this.pendingTossupProtestEvent = {
            position,
            questionIndex,
            reason: "",
            teamName,
        };
    }

    @action
    public setSheetsApiInitialized(state: LoadingState): void {
        this.sheetsState.apiInitialized = state;
    }

    @action
    public setSheetsId(id: string): void {
        this.sheetsState.sheetId = id;
    }

    @action
    public setSelectedWordIndex(newIndex: number): void {
        this.selectedWordIndex = newIndex;
    }

    @action
    public hideBuzzMenu(): void {
        this.buzzMenuVisible = false;
    }

    @action
    public resetPendingBonusProtest(): void {
        this.pendingBonusProtestEvent = undefined;
    }

    @action
    public resetPendingNewGame(): void {
        this.pendingNewGame = undefined;
        this.packetParseStatus = undefined;
    }

    @action
    public resetPendingNewPlayer(): void {
        this.pendingNewPlayer = undefined;
    }

    @action
    public resetPendingSheet(): void {
        this.pendingSheet = undefined;
    }

    @action
    public resetPendingTossupProtest(): void {
        this.pendingTossupProtestEvent = undefined;
    }

    @action
    public resetSheetsId(): void {
        this.sheetsState.sheetId = undefined;
    }

    @action
    public showBuzzMenu(): void {
        this.buzzMenuVisible = true;
    }

    @action
    public updatePendingProtestReason(reason: string): void {
        if (this.pendingBonusProtestEvent != undefined) {
            this.pendingBonusProtestEvent.reason = reason;
        } else if (this.pendingTossupProtestEvent != undefined) {
            this.pendingTossupProtestEvent.reason = reason;
        }
    }

    @action
    public updatePendingBonusProtestPart(part: string | number): void {
        if (this.pendingBonusProtestEvent != undefined) {
            const partIndex = typeof part === "string" ? parseInt(part, 10) : part;
            this.pendingBonusProtestEvent.partIndex = partIndex;
        }
    }

    @action
    public updatePendingNewPlayerName(name: string): void {
        if (this.pendingNewPlayer == undefined) {
            return;
        }

        this.pendingNewPlayer.name = name;
    }

    @action
    public updatePendingNewPlayerTeamName(teamName: string): void {
        if (this.pendingNewPlayer == undefined) {
            return;
        }

        this.pendingNewPlayer.teamName = teamName;
    }

    @action
    public updatePendingSheetRoundNumber(roundNumber: number): void {
        if (this.pendingSheet == undefined) {
            return;
        }

        this.pendingSheet.roundNumber = roundNumber;
    }

    @action
    public updatePendingSheetId(sheetId: string): void {
        if (this.pendingSheet == undefined) {
            return;
        }

        this.pendingSheet.sheetId = sheetId;
    }
}
