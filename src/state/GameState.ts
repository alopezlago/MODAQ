import { computed, observable } from "mobx";

import { PacketState } from "./PacketState";
import { Team } from "./TeamState";
import { Cycle } from "./Cycle";

export class GameState {
    @observable
    public packet: PacketState;

    @observable
    public firstTeam: Team;

    @observable
    public secondTeam: Team;

    @observable
    public cycles: Cycle[];

    constructor() {
        this.packet = new PacketState();

        this.firstTeam = new Team();
        this.secondTeam = new Team();

        this.cycles = [];
    }

    @computed
    public get teams(): Team[] {
        return [this.firstTeam, this.secondTeam];
    }
}