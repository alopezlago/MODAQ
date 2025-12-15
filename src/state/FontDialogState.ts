import { makeAutoObservable } from "mobx";
import { ignore } from "mobx-sync";

export const DefaultFontFamily = "Times New Roman, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, serif";

export class FontDialogState {
    @ignore
    public fontFamily: string | undefined;

    @ignore
    public fontSize: number | undefined;

    @ignore
    public pronunciationGuideColor: string | undefined;

    @ignore
    public textColor: string | undefined;

    constructor(
        fontFamily: string | undefined,
        fontSize: number | undefined,
        textColor: string | undefined,
        pronunciationGuideColor: string | undefined
    ) {
        makeAutoObservable(this);

        this.fontFamily = fontFamily;
        this.fontSize = fontSize;
        this.pronunciationGuideColor = pronunciationGuideColor;
        this.textColor = textColor;
    }

    public resetPronunciationGuideColor(): void {
        this.pronunciationGuideColor = undefined;
    }

    public resetTextColor(): void {
        this.textColor = undefined;
    }

    public setFontFamily(listedFont: string): void {
        this.fontFamily = listedFont + ", " + DefaultFontFamily;
    }

    public setFontSize(fontSize: number): void {
        this.fontSize = fontSize;
    }

    public setPronunciationGuideColor(color: string): void {
        this.pronunciationGuideColor = color;
    }

    public setTextColor(color: string): void {
        this.textColor = color;
    }
}
