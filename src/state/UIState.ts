import { observable, action } from "mobx";
import { ITossupProtestEvent, IBonusProtestEvent } from "./Events";
import { ignore } from "mobx-sync";
import { IPendingNewGame } from "./IPendingNewGame";
import { PacketState } from "./PacketState";
import { Player } from "./TeamState";

export class UIState {
    constructor() {
        this.cycleIndex = 0;
        this.isEditingCycleIndex = false;
        this.selectedWordIndex = -1;
        this.buzzMenuVisible = false;
        this.pendingBonusProtestEvent = undefined;
        this.pendingNewGame = undefined;
        this.pendingTossupProtestEvent = undefined;
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
    public pendingBonusProtestEvent?: IBonusProtestEvent;

    @observable
    @ignore
    public pendingNewGame?: IPendingNewGame;

    @observable
    @ignore
    public pendingTossupProtestEvent?: ITossupProtestEvent;

    // TODO: Feels off. Could generalize to array of teams
    @action
    public addPlayerToFirstTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame != undefined) {
            this.pendingNewGame?.firstTeamPlayers.push(player);
        }
    }

    @action
    public addPlayerToSecondTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame != undefined) {
            this.pendingNewGame?.secondTeamPlayers.push(player);
        }
    }

    @action
    public removePlayerToFirstTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame != undefined) {
            this.pendingNewGame.firstTeamPlayers = this.pendingNewGame?.firstTeamPlayers.filter((p) => p !== player);
        }
    }

    @action
    public removePlayerToSecondTeamInPendingNewGame(player: Player): void {
        if (this.pendingNewGame != undefined) {
            this.pendingNewGame.secondTeamPlayers = this.pendingNewGame?.secondTeamPlayers.filter((p) => p !== player);
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
    }

    @action
    public resetPendingTossupProtest(): void {
        this.pendingTossupProtestEvent = undefined;
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
}
