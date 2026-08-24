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
     * Adds or replaces the erratum for a question (keyed by number + type). Blank text removes it, so clearing the
     * text field in the dialog is the same as deleting the note.
     */
    public setErratum(erratum: IErratum): void {
        const text: string = erratum.text.trim();
        if (text.length === 0 && !erratum.thrownOut) {
            this.removeErratum(erratum.questionNumber, erratum.questionType);
            return;
        }

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
