import { makeAutoObservable } from "mobx";

// The order the teams will be in, while the Reorder Teams dialog is open. Only
// used with more than two teams; two are simply swapped.
export class ReorderTeamsDialogState {
    public teamNames: string[];

    constructor(teamNames: string[]) {
        makeAutoObservable(this);

        this.teamNames = [...teamNames];
    }

    public moveTeam(index: number, by: number): void {
        const to: number = index + by;
        if (index < 0 || index >= this.teamNames.length || to < 0 || to >= this.teamNames.length) {
            return;
        }

        const names: string[] = [...this.teamNames];
        const [team] = names.splice(index, 1);
        names.splice(to, 0, team);
        this.teamNames = names;
    }
}
