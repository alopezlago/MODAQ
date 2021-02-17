import { makeAutoObservable } from "mobx";

// TODO: Investigate if Team should just have an array of players, since we don't need to normalize these values in mobx
// This could simplify the format
export class Player implements IPlayer {
    public isStarter: boolean;

    public name: string;

    public teamName: string;

    constructor(name: string, teamName: string, isStarter: boolean) {
        makeAutoObservable(this);

        this.name = name;
        this.teamName = teamName;
        this.isStarter = isStarter;
    }

    public setStarterStatus(isStarter: boolean): void {
        this.isStarter = isStarter;
    }

    public setName(newName: string): void {
        this.name = newName;
    }

    public setTeamName(teamName: string): void {
        this.teamName = teamName;
    }
}

export interface IPlayer {
    name: string;
    teamName: string;
    isStarter: boolean;
}
