import { makeAutoObservable } from "mobx";

import { PacketState } from "./PacketState";

export class AddQuestionDialogState {
    public newPacket: PacketState;

    constructor() {
        makeAutoObservable(this);

        this.newPacket = new PacketState();
    }

    public setPacket(packet: PacketState): void {
        this.newPacket = packet;
    }
}
