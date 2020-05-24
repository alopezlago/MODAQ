import { observable } from "mobx";

export class Team {
    @observable
    public name: string;

    @observable
    public players: Player[];
}

export class Player {
    @observable
    public name: string;

    constructor(name: string) {
        this.name = name;
    }
}