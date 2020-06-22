import { observable, action } from "mobx";

export class Team {
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

export class Player {
    @observable
    public name: string;

    @observable
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
