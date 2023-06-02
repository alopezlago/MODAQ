import { makeAutoObservable } from "mobx";
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
        let nextTeammateIndex = -1;
        for (let i = this.players.length - 1; i >= 0; i--) {
            const currentPlayer: Player = this.players[i];
            if (player === currentPlayer) {
                if (nextTeammateIndex === -1) {
                    // Current player is in front, we can't move them
                    return;
                }

                this.players[i] = this.players[nextTeammateIndex];
                this.players[nextTeammateIndex] = player;
                return;
            }

            if (this.players[i].teamName === player.teamName) {
                nextTeammateIndex = i;
            }
        }
    }

    public movePlayerForward(player: Player): void {
        let previousTeammateIndex = -1;
        for (let i = 0; i < this.players.length; i++) {
            const currentPlayer: Player = this.players[i];
            if (player === currentPlayer) {
                if (previousTeammateIndex === -1) {
                    // Current player is in front, we can't move them
                    return;
                }

                this.players[i] = this.players[previousTeammateIndex];
                this.players[previousTeammateIndex] = player;
                return;
            }

            if (this.players[i].teamName === player.teamName) {
                previousTeammateIndex = i;
            }
        }
    }

    public movePlayerToIndex(player: Player, index: number): void {
        if (index < 0) {
            return;
        }

        const teamName: string = player.teamName;
        let sameTeamCount = -1;
        for (let i = 0; i < this.players.length; i++) {
            const currentPlayer: Player = this.players[i];
            if (currentPlayer.teamName === teamName) {
                sameTeamCount++;
            }

            if (sameTeamCount === index) {
                let newPlayers = this.players.filter((p) => p !== player);
                newPlayers = newPlayers.slice(0, i).concat(player).concat(newPlayers.slice(i));
                this.players = newPlayers;
                return;
            }
        }

        // Index is beyond the number of players in the team. Treat it as a no-op
    }
}
