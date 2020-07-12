import { observable, action } from "mobx";

// TODO: Investigate if Team should just have an array of players, since we don't need to normalize these values in mobx
// This could simplify the format
export class Player implements IPlayer {
    @observable
    public isStarter: boolean;

    @observable
    public name: string;

    @observable
    public teamName: string;

    constructor(name: string, teamName: string, isStarter: boolean) {
        this.name = name;
        this.teamName = teamName;
        this.isStarter = isStarter;
    }

    @action
    public setStarterStatus(isStarter: boolean): void {
        this.isStarter = isStarter;
    }

    @action
    public setName(newName: string): void {
        this.name = newName;
    }

    @action
    public setTeamName(teamName: string): void {
        this.teamName = teamName;
    }
}

export interface IPlayer {
    name: string;
    teamName: string;
    isStarter: boolean;
}
