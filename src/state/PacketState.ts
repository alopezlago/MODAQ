import { makeAutoObservable } from "mobx";
import { format } from "mobx-sync";

import * as FormattedTextParser from "../parser/FormattedTextParser";
import { IFormattedText } from "../parser/IFormattedText";
import { IGameFormat } from "./IGameFormat";

export class PacketState {
    // Anything with methods/computeds not at the top level needs to use @format to deserialize correctly
    @format((deserializedArray: IQuestion[]) => {
        return deserializedArray.map((deserializedTossup) => {
            return new Tossup(deserializedTossup.question, deserializedTossup.answer, deserializedTossup.metadata);
        });
    })
    public tossups: Tossup[];

    public bonuses: Bonus[];

    public name: string | undefined;

    constructor() {
        makeAutoObservable(this);

        this.tossups = [];
        this.bonuses = [];
        this.name = undefined;
    }

    public setTossups(tossups: Tossup[]): void {
        this.tossups = tossups;
    }

    public setBonuses(bonuses: Bonus[]): void {
        this.bonuses = bonuses;
    }

    public setName(name: string | undefined): void {
        this.name = name;
    }
}

export interface IQuestion {
    question: string;
    answer: string;
    metadata?: string;
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
    public metadata: string | undefined;

    constructor(question: string, answer: string, metadata?: string) {
        makeAutoObservable(this);

        this.question = question;
        this.answer = answer;
        this.metadata = metadata;
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
            const currentPowerMarkerIndex = words.findIndex(
                (value, index) => index >= powerMarkerIndex && value.startsWith(powerMarker)
            );
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
        const formattedTexts: IFormattedText[][] = this.formattedQuestionText(format);
        const words: ITossupWord[] = [];
        let wordIndex = 0;
        let nonwordIndex = 0;
        for (let i = 0; i < formattedTexts.length; i++) {
            const word: IFormattedText[] = formattedTexts[i];
            const fullText = word.reduce((result, text) => result + text.text, "");
            const isLastWord: boolean = i === formattedTexts.length - 1;
            const inPronunciationGuide: boolean = word.length > 0 && word[0].pronunciation === true;

            // We need to skip over power markers and not count them when we calculate buzz points
            let canBuzzOn = true;
            let index: number = wordIndex;
            const trimmedText: string = fullText.trim();
            const powerMarkerIndex: number = format.powers.findIndex((power) => trimmedText.startsWith(power.marker));
            if (isLastWord) {
                // Last word should always be the terminal character, which can't be a power or in a pronunciation guide
                wordIndex++;
            } else if (powerMarkerIndex >= 0) {
                // Power markers have priority over pronunciation guides, and shouldn't be treated as such
                for (const segment of word) {
                    segment.pronunciation = false;
                }

                canBuzzOn = false;
                index = nonwordIndex;
                nonwordIndex++;
            } else if (inPronunciationGuide) {
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
                    canBuzzOn,
                });
            }
        }

        return words;
    }

    private formattedQuestionText(format: IGameFormat): IFormattedText[][] {
        // Include the ■ to give an end of question marker
        return FormattedTextParser.splitFormattedTextIntoWords(this.question, {
            pronunciationGuideMarkers: format.pronunciationGuideMarkers,
        }).concat([[{ text: "■END■", bolded: true, emphasized: false, required: false, pronunciation: false }]]);
    }
}

export class Bonus {
    public leadin: string;

    public parts: BonusPart[];

    public metadata: string | undefined;

    constructor(leadin: string, parts: BonusPart[], metadata?: string) {
        // We don't use makeAutoObservable because leadin doesn't need to be observable (never changes)
        makeAutoObservable(this);

        this.leadin = leadin.trim();
        this.parts = parts;
        this.metadata = metadata;
    }
}

export function getBonusWords(text: string, format: IGameFormat): IFormattedText[] {
    return FormattedTextParser.parseFormattedText(text, {
        pronunciationGuideMarkers: format.pronunciationGuideMarkers,
    });
}

export type ITossupWord = IBuzzableTossupWord | INonbuzzableTossupWord;

export interface IBuzzableTossupWord extends IBaseTossupWord {
    wordIndex: number;
    isLastWord: boolean;
    canBuzzOn: true;
}

export interface INonbuzzableTossupWord extends IBaseTossupWord {
    nonWordIndex: number;
    canBuzzOn: false;
}

interface IBaseTossupWord {
    word: IFormattedText[];
    textIndex: number;
}
