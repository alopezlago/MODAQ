import { makeAutoObservable } from "mobx";

import * as PlayerUtils from "./PlayerUtils";
import { Player } from "./TeamState";

export class ReorderPlayersDialogState {
    public teamName: string;

    public players: Player[];

    constructor(players: Player[]) {
        makeAutoObservable(this);

        this.players = players;
        this.teamName = players.length > 0 ? players[0].teamName : "";
    }

    public setTeamName(newTeam: string): void {
        this.teamName = newTeam;
    }

    public movePlayerBackward(player: Player): void {
        this.players = PlayerUtils.movePlayerBackward(this.players, player);
    }

    public movePlayerForward(player: Player): void {
        this.players = PlayerUtils.movePlayerForward(this.players, player);
    }

    public movePlayerToIndex(player: Player, index: number): void {
        this.players = PlayerUtils.movePlayerToIndex(this.players, player, index);
    }
}
