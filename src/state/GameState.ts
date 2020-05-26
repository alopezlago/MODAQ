import { computed, observable, action } from "mobx";

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
    public get isLoaded(): boolean {
        return this.packet.tossups.length > 0;
    }

    @computed
    public get teams(): Team[] {
        return [this.firstTeam, this.secondTeam];
    }

    @action
    public loadPacket(packet: PacketState): void {
        this.packet = packet;

        if (this.cycles.length < this.packet.tossups.length) {
            // TODO: Don't create cycles for tiebreaker rounds once we create packet formats to specify limits
            for (let i = this.cycles.length; i < this.packet.tossups.length; i++) {
                this.cycles.push(new Cycle());
            }
        }
    }
}