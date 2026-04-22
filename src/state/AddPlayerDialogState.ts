import { makeAutoObservable } from "mobx";
import { Player } from "./TeamState";

export class AddPlayerDialogState {
    public errorMessage: string | undefined;

    public player: Player;

    public isActive: boolean;

    constructor(teamName: string) {
        makeAutoObservable(this);

        this.player = new Player("", teamName, /* isStarter */ false);
        this.isActive = true;
    }

    public clearErrorMessage(): void {
        this.errorMessage = undefined;
    }

    public setErrorMessage(errorMessage: string): void {
        this.errorMessage = errorMessage;
    }

    public setIsActive(isActive: boolean): void {
        this.isActive = isActive;
    }

    public setName(newName: string): void {
        this.player.setName(newName);
    }

    public setTeamName(newName: string): void {
        this.player.setTeamName(newName);
    }
}
