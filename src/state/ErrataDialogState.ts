import { makeAutoObservable } from "mobx";

import { QuestionType } from "./IErratum";

// The erratum being edited. The question is fixed when the dialog opens (it's opened from that question's errata
// icon), so only the text is editable.
export class ErrataDialogState {
    public questionNumber: number;

    public questionType: QuestionType;

    public text: string;

    /**
     * Whether the question already had an erratum when the dialog opened, which decides if the dialog offers to
     * remove it.
     */
    public existed: boolean;

    constructor(questionNumber: number, questionType: QuestionType, text: string) {
        makeAutoObservable(this);

        this.questionNumber = questionNumber;
        this.questionType = questionType;
        this.text = text;
        this.existed = text.length > 0;
    }

    public setText(text: string): void {
        this.text = text;
    }
}
