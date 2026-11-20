import { makeAutoObservable } from "mobx";

import { IErratum, QuestionType } from "./IErratum";

// Moderator-reported errata for the loaded packet. These describe the *packet*, not the match events, so they're
// kept out of GameState (and out of the QBJ/game exports that stats programs like YellowFruit read). They get their
// own export instead; see ErrataExport.
export class ErrataState {
    public errata: IErratum[];

    constructor() {
        makeAutoObservable(this);

        this.errata = [];
    }

    public getErratum(questionNumber: number, questionType: QuestionType): IErratum | undefined {
        return this.errata.find(
            (erratum) => erratum.questionNumber === questionNumber && erratum.questionType === questionType
        );
    }

    /**
     * Errata ordered the way the questions are read, so exports and lists are stable.
     */
    public getSortedErrata(): IErratum[] {
        return this.errata
            .slice()
            .sort(
                (left, right) =>
                    left.questionNumber - right.questionNumber ||
                    left.questionType.localeCompare(right.questionType)
            );
    }

    /**
     * Adds or replaces the erratum for a question (keyed by number + type). The text may be blank: during the round
     * moderators only mark the question, and add the details when they review the errata at the end of the round.
     */
    public setErratum(erratum: IErratum): void {
        const text: string = erratum.text.trim();
        this.errata = this.errata
            .filter(
                (existing) =>
                    !(
                        existing.questionNumber === erratum.questionNumber &&
                        existing.questionType === erratum.questionType
                    )
            )
            .concat([{ ...erratum, text, at: erratum.at ?? Date.now() }]);
    }

    /**
     * Marks a question as having an erratum, without details. Toggling a question that's only marked unmarks it, so
     * an accidental mark is easy to undo; a question whose erratum already has details stays marked, so those details
     * can't be lost to a stray key press. Returns whether the question is marked afterwards.
     */
    public toggleMark(questionNumber: number, questionType: QuestionType): boolean {
        const existing: IErratum | undefined = this.getErratum(questionNumber, questionType);
        if (existing == undefined) {
            this.setErratum({ questionNumber, questionType, thrownOut: false, text: "" });
            return true;
        }

        if (existing.text.trim().length === 0) {
            this.removeErratum(questionNumber, questionType);
            return false;
        }

        return true;
    }

    /**
     * Updates the details of an erratum that's already marked. The text isn't trimmed, since this is called as the
     * moderator types; the export trims it.
     */
    public setText(questionNumber: number, questionType: QuestionType, text: string): void {
        this.errata = this.errata.map((existing) =>
            existing.questionNumber === questionNumber && existing.questionType === questionType
                ? { ...existing, text }
                : existing
        );
    }

    public removeErratum(questionNumber: number, questionType: QuestionType): void {
        this.errata = this.errata.filter(
            (existing) => !(existing.questionNumber === questionNumber && existing.questionType === questionType)
        );
    }

    /**
     * Replaces every erratum, e.g. with ones a host loaded from its own storage.
     */
    public setErrata(errata: IErratum[]): void {
        this.errata = errata.map((erratum) => ({ ...erratum }));
    }

    public clear(): void {
        this.errata = [];
    }
}
