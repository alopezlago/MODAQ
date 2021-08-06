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

export interface BonusPart {
    question: string;
    answer: string;
    value: number;
    difficultyModifier?: string;
}

export class Tossup implements IQuestion {
    private static readonly noPronunciationGuides: [string | undefined, string | undefined] = [undefined, undefined];

    public question: string;
    public answer: string;

    constructor(question: string, answer: string) {
        makeAutoObservable(this);

        this.question = question;
        this.answer = answer;
    }

    private get formattedQuestionText(): IFormattedText[][] {
        // Include the ■ to give an end of question marker
        return FormattedTextParser.splitFormattedTextIntoWords(this.question).concat([
            [{ text: "■END■", bolded: true, emphasized: false, required: false }],
        ]);
    }

    public getPointsAtPosition(format: IGameFormat, wordIndex: number, isCorrect = true): number {
        // If there's no powers, default to 10 points
        if (format.powers.length === 0 && isCorrect) {
            return 10;
        }

        const tossupWords: ITossupWord[] = this.getWords(format);
        const words: string[] = tossupWords.map((questionText) =>
            questionText.word.reduce((result, text) => result + text.text, "").trim()
        );
        // Ignore the last word, which is an end of question marker
        const lastIndex: number = words.length - 1;

        let powerMarkerIndex = 0;
        for (let i = 0; i < format.powers.length; i++) {
            const powerMarker: string = format.powers[i].marker.trim();
            const currentPowerMarkerIndex = words.indexOf(powerMarker, powerMarkerIndex);
            if (currentPowerMarkerIndex === -1) {
                continue;
            }

            powerMarkerIndex = currentPowerMarkerIndex;
            const powerMarkerWord: ITossupWord = tossupWords[powerMarkerIndex];

            // To get the word index, we need to subtract the count of non-words from the text index. We only have the
            // non-word index, so we have to add 1 to that to get the count (TI - (NWI + 1)). If we use < rather than
            // <=, we can remove the -1.
            if (
                isCorrect &&
                powerMarkerIndex !== lastIndex &&
                !powerMarkerWord.canBuzzOn &&
                wordIndex < powerMarkerWord.textIndex - powerMarkerWord.nonWordIndex
            ) {
                return format.powers[i].points;
            }
        }

        if (!isCorrect) {
            // If we're at the end of the question, don't count it as a neg
            // We add an extra word for the end of question marker, so remove that from the list of words, as well as all of
            // the power markers we skipped
            const lastWord: ITossupWord = tossupWords[tossupWords.length - 1];
            if (!lastWord.canBuzzOn) {
                // Something weird is happening, since the last word should always be buzzable (as the end marker).
                throw new Error("Last word not buzzable, but must be buzzable by design");
            }

            return wordIndex >= lastWord.wordIndex ? 0 : format.negValue;
        }

        // Not in power, so return the default value
        return 10;
    }

    public getWords(format: IGameFormat): ITossupWord[] {
        const pronunciationGuideMarkers: [string | undefined, string | undefined] =
            format.pronunciationGuideMarkers != undefined && format.pronunciationGuideMarkers.length === 2
                ? format.pronunciationGuideMarkers
                : Tossup.noPronunciationGuides;

        const formattedTexts: IFormattedText[][] = this.formattedQuestionText;
        const words: ITossupWord[] = [];
        let wordIndex = 0;
        let nonwordIndex = 0;
        let inPronunciationGuide = false;
        for (let i = 0; i < formattedTexts.length; i++) {
            const word: IFormattedText[] = formattedTexts[i];
            const fullText = word.reduce((result, text) => result + text.text, "");
            const isLastWord: boolean = i === formattedTexts.length - 1;

            // We need to skip over power markers and not count them when we calculate buzz points
            let canBuzzOn = true;
            let index: number = wordIndex;
            const trimmedText: string = fullText.trim();
            const powerMarkerIndex: number = format.powers.findIndex((power) => power.marker === trimmedText);
            if (isLastWord) {
                // Last word should always be the terminal character, which can't be a power or in a pronunciation guide
                wordIndex++;
            } else if (powerMarkerIndex >= 0) {
                // Power markers have priority over pronunciation guides
                canBuzzOn = false;
                index = nonwordIndex;
                nonwordIndex++;
            } else if (
                inPronunciationGuide ||
                (pronunciationGuideMarkers[0] != undefined && trimmedText.startsWith(pronunciationGuideMarkers[0]))
            ) {
                // If we're in a pronunciation guide or at the start of one, then count it as a non-word
                inPronunciationGuide = true;
                canBuzzOn = false;
                index = nonwordIndex;
                nonwordIndex++;
            } else {
                wordIndex++;
            }

            if (canBuzzOn) {
                words.push({
                    wordIndex: index,
                    textIndex: i,
                    word,
                    isLastWord,
                    canBuzzOn,
                });
            } else {
                words.push({
                    nonWordIndex: index,
                    textIndex: i,
                    word,
                    inPronunciationGuide,
                    canBuzzOn,
                });
            }

            if (
                inPronunciationGuide &&
                pronunciationGuideMarkers[1] != undefined &&
                trimmedText.indexOf(pronunciationGuideMarkers[1]) >= 0
            ) {
                inPronunciationGuide = false;
            }
        }

        return words;
    }
}

export class Bonus {
    public leadin: string;

    public parts: BonusPart[];

    constructor(leadin: string, parts: BonusPart[]) {
        // We don't use makeAutoObservable because leadin doesn't need to be observable (never changes)
        makeObservable(this, {
            parts: observable,
        });

        this.leadin = leadin;
        this.parts = parts;
    }
}

export type ITossupWord = IBuzzableTossupWord | INonbuzzableTossupWord;

export interface IBuzzableTossupWord extends IBaseTossupWord {
    wordIndex: number;
    isLastWord: boolean;
    canBuzzOn: true;
}

export interface INonbuzzableTossupWord extends IBaseTossupWord {
    nonWordIndex: number;
    inPronunciationGuide: boolean;
    canBuzzOn: false;
}

interface IBaseTossupWord {
    word: IFormattedText[];
    textIndex: number;
}
