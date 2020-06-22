import { observable, action } from "mobx";
import { format } from "mobx-sync";

export class Team implements ITeam {
    @observable
    public name: string;

    constructor(name = "") {
        this.name = name;
    }

    @action
    public setName(newName: string): void {
        this.name = newName;
    }
}

export class Player implements IPlayer {
    @observable
    public name: string;

    @observable
    @format((deserializedTeam: ITeam) => new Team(deserializedTeam.name))
    public team: Team;

    constructor(name: string, team: Team) {
        this.name = name;
        this.team = team;
    }

    @action
    public setName(newName: string): void {
        this.name = newName;
    }

    @action
    public setTeam(team: Team): void {
        this.team = team;
    }
}

export interface IPlayer {
    name: string;
    team: ITeam;
}

export interface ITeam {
    name: string;
}
