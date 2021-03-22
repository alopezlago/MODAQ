import { observable, makeObservable, makeAutoObservable } from "mobx";
import { format } from "mobx-sync";

import * as FormattedTextParser from "src/parser/FormattedTextParser";
import { IFormattedText } from "src/parser/IFormattedText";
import { IGameFormat } from "./IGameFormat";

export class PacketState {
    // Anything with methods/computeds not at the top level needs to use @format to deserialize correctly
    @format((deserializedArray: IQuestion[]) => {
        return deserializedArray.map((deserializedTossup) => {
            return new Tossup(deserializedTossup.question, deserializedTossup.answer);
        });
    })
    public tossups: Tossup[];

    public bonuses: Bonus[];

    constructor() {
        makeAutoObservable(this);

        this.tossups = [];
        this.bonuses = [];
    }

    public setTossups(tossups: Tossup[]): void {
        this.tossups = tossups;
    }

    public setBonuses(bonuses: Bonus[]): void {
        this.bonuses = bonuses;
    }
}

export interface IQuestion {
    question: string;
    answer: string;
}

export class IBonusPart implements IQuestion {
    public question: string;
    public answer: string;
    public value: number;

    constructor(question: string, answer: string, value = 10) {
        this.question = question;
        this.answer = answer;
        this.value = value;
    }
}

export class Tossup implements IQuestion {
    public question: string;
    public answer: string;

    constructor(question: string, answer: string) {
        makeAutoObservable(this);

        this.question = question;
        this.answer = answer;
    }

    public get formattedQuestionText(): IFormattedText[][] {
        // Include the ■ to give an end of question marker
        return FormattedTextParser.splitFormattedTextIntoWords(this.question).concat([
            [{ text: "■", bolded: false, emphasized: false, required: false }],
        ]);
    }

    public getPointsAtPosition(format: IGameFormat, wordIndex: number): number {
        // If there's no powers, default to 10 points
        if (format.powerMarkers.length === 0) {
            return 10;
        }

        const formattedQuestionText: IFormattedText[][] = this.formattedQuestionText;

        const words: string[] = formattedQuestionText.map((questionText) =>
            questionText.reduce((result, text) => result + text.text, "").trim()
        );

        // Ignore the last word, which is an end of question marker
        const lastWordIndex: number = words.length - 1;

        // Go through each power value, and see if it appears in the question text. If it does, and the buzz is before
        // that point, give them that power.
        // One potential optimization would be to remove all the words up to that index if we find it, so we have to
        // look through less words
        let powerMarkersFound = 0;
        for (let i = 0; i < format.powerMarkers.length; i++) {
            const powerMarker: string = format.powerMarkers[i];
            const powerMarkerIndex: number = words.indexOf(powerMarker);

            // TODO: When we skip over pronunication guides, we'll need to calculate how many words they take up, so
            // we can correctly see if the buzz is in power
            // For a tossup a b (+) c (*) d
            // If the buzz is at position 1 (b), 1 < 2 - 0, so we'll get the superpower
            // If the buzz is at position 2 (c), 2 < 2 will fail. The next marker is at index 4, and 2 < 4 - 1 => 2 < 3,
            // so they will get the power.
            // If the buzz is at position 3, though (d), 3 < 4 - 1= > 3 < 3 is false, so they will get the default value
            if (powerMarkerIndex >= 0) {
                // We only want to correct the index for the power markers found. Some questions may not have
                // superpowers, so don't count them if we didn't find them.
                if (powerMarkerIndex !== lastWordIndex && wordIndex <= powerMarkerIndex - (powerMarkersFound + 1)) {
                    return format.pointsForPowers[i];
                }

                powerMarkersFound++;
            }
        }

        // Not in power, so return the default value
        return 10;
    }
}

export class Bonus {
    public leadin: string;

    public parts: IBonusPart[];

    constructor(leadin: string, parts: IBonusPart[]) {
        // We don't use makeAutoObservable because leadin doesn't need to be observable (never changes)
        makeObservable(this, {
            parts: observable,
        });

        this.leadin = leadin;
        this.parts = parts;
    }
}
