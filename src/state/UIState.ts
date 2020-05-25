import { observable, action } from "mobx";

export class UIState {
    constructor() {
        this.cycleIndex = 0;
        this.isEditingCycleIndex = false;
    }

    @observable
    public cycleIndex: number;

    @observable
    public isEditingCycleIndex: boolean;

    @action
    public nextCycle(): void {
        this.cycleIndex++;
    }

    @action
    public previousCycle(): void {
        if (this.cycleIndex > 0) {
            this.cycleIndex--;
        }
    }

    @action
    public setCycleIndex(newIndex: number): void {
        if (newIndex >= 0) {
            this.cycleIndex = newIndex;
        }
    }

    @action
    public setIsEditingCycleIndex(isEditingCycleIndex: boolean): void {
        this.isEditingCycleIndex = isEditingCycleIndex;
    }
}