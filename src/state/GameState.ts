import { computed, observable } from "mobx";

import { PacketState } from "./PacketState";
import { Team } from "./TeamState";

export class GameState {
    @observable
    public packet: PacketState;

    @observable
    public firstTeam: Team;

    @observable
    public secondTeam: Team;

    constructor() {
        this.packet = new PacketState();

        this.firstTeam = new Team();
        this.secondTeam = new Team();
    }

    @computed
    public get teams(): Team[] {
        return [this.firstTeam, this.secondTeam];
    }
}