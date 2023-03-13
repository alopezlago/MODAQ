import { makeAutoObservable } from "mobx";
import { Player } from "./TeamState";

export class RenamePlayerDialogState {
    public errorMessage: string | undefined;

    public newName: string;

    public player: Player;

    constructor(player: Player) {
        makeAutoObservable(this);

        this.errorMessage = undefined;
        this.newName = "";
        this.player = player;
    }

    public clearErrorMessage(): void {
        this.errorMessage = undefined;
    }

    public setErrorMessage(errorMessage: string): void {
        this.errorMessage = errorMessage;
    }

    public setName(newName: string): void {
        this.newName = newName;
    }

    public setPlayer(player: Player): void {
        this.player = player;
    }
}
