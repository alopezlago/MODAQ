import { makeAutoObservable } from "mobx";
import { IGameFormat } from "./IGameFormat";

export class CustomizeGameFormatDialogState {
    public gameFormat: IGameFormat;

    // Based on the UI, we have to store powerMarkers/powerValues separately. This is a bit of a leaky abstraction
    // (state shouldn't know about the view), which we should try to fix
    public powerMarkers: string[];

    public powerValues: string;

    public pronunicationGuideMarkers: string[] | undefined;

    public powerMarkerErrorMessage: string | undefined;

    public powerValuesErrorMessage: string | undefined;

    public pronunciationGuideMarkersErrorMessage: string | undefined;

    constructor(existingGameFormat: IGameFormat) {
        makeAutoObservable(this);

        this.gameFormat = { ...existingGameFormat };
        this.powerMarkers = this.gameFormat.powers.map((power) => power.marker);
        this.powerMarkerErrorMessage = undefined;

        this.powerValues = this.gameFormat.powers.map((power) => power.points).join(",");
        this.powerValuesErrorMessage = undefined;

        this.pronunicationGuideMarkers = this.gameFormat.pronunciationGuideMarkers;
        this.pronunciationGuideMarkersErrorMessage = undefined;
    }

    public clearPowerErrorMessages(): void {
        this.powerMarkerErrorMessage = undefined;
        this.powerValuesErrorMessage = undefined;
    }

    public clearPronunciationGuideMarkersErrorMessage(): void {
        this.pronunciationGuideMarkersErrorMessage = undefined;
    }

    public setPowerMarkers(powerMarkers: string[]): void {
        // Clear the error message if we have a new value
        this.powerMarkers = powerMarkers;
        this.powerMarkerErrorMessage = undefined;
    }

    public setPowerMarkerErrorMessage(message: string): void {
        this.powerMarkerErrorMessage = message;
    }

    public setPowerValues(powerValues: string): void {
        // Clear the error message if we have a new value
        this.powerValues = powerValues;
        this.powerValuesErrorMessage = undefined;
    }

    public setPowerValuesErrorMessage(message: string): void {
        this.powerValuesErrorMessage = message;
    }

    public setPronunciationGuideMarkers(pronunciationGuideMarkers: string[]): void {
        this.pronunicationGuideMarkers = pronunciationGuideMarkers;
        this.clearPronunciationGuideMarkersErrorMessage();
    }

    public setPronunciationGuideMarkersErrorMessage(message: string): void {
        this.pronunciationGuideMarkersErrorMessage = message;
    }

    public updateGameFormat(gameFormatUpdate: Partial<IGameFormat>): void {
        this.gameFormat = { ...this.gameFormat, ...gameFormatUpdate };

        if (gameFormatUpdate.powers != undefined) {
            this.setPowerValues(this.gameFormat.powers.map((power) => power.points).join(","));
            this.setPowerMarkers(this.gameFormat.powers.map((power) => power.marker));
        }

        if (gameFormatUpdate.pronunciationGuideMarkers != undefined) {
            this.pronunciationGuideMarkersErrorMessage = undefined;
            this.pronunicationGuideMarkers = this.gameFormat.pronunciationGuideMarkers;
        }
    }
}
