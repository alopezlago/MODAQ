import { observable } from "mobx";

export class UIState {
    constructor() {
        this.cycleIndex = 0;
        this.isEditingCycleIndex = false;
    }

    @observable
    public cycleIndex: number;

    @observable
    public isEditingCycleIndex: boolean;

    public nextCycle(): void {
        this.cycleIndex++;
    }

    public previousCycle(): void {
        if (this.cycleIndex > 0) {
            this.cycleIndex--;
        }
    }

    public setCycleIndex(newIndex: number): void {
        if (newIndex >= 0) {
            this.cycleIndex = newIndex;
        }
    }

    public setIsEditingCycleIndex(isEditingCycleIndex: boolean): void {
        this.isEditingCycleIndex = isEditingCycleIndex;
    }
}