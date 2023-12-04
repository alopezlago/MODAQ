import { makeAutoObservable } from "mobx";

export class RenameTeamDialogState {
    public errorMessage: string | undefined;

    public newName: string;

    public teamName: string;

    constructor(initialTeamName: string) {
        makeAutoObservable(this);

        this.errorMessage = undefined;
        this.newName = initialTeamName;
        this.teamName = initialTeamName;
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

    public setTeam(teamName: string): void {
        this.teamName = teamName;
    }
}
