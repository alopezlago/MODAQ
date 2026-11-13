// Text handling shared by the reader follower: turning packet text and speech transcripts into comparable tokens,
// and scoring how alike two tokens are.
//
// Packet text and transcripts disagree on form in predictable ways: "Franco-Prussian" is one packet word but two
// spoken words, packets write "1848" while some recognizers write "eighteen forty eight", and recognizers write
// "gray" for "grey" or split an unfamiliar name into pieces. Tokenizing both sides the same way (splitting on
// hyphens and slashes, spelling out numbers) removes most of these differences before matching.

/**
 * Normalizes a word so spoken transcripts can be compared with packet text: lowercases it and strips accents
 * and any punctuation.
 */
export function normalizeSpokenWord(word: string): string {
    // NFD splits accented letters into the base letter plus combining marks, which the second replace strips out
    // along with any punctuation
    return word
        .toLowerCase()
        .normalize("NFD")
        .replace(/[^a-z0-9]/g, "");
}

/**
 * Splits text (a packet word or a transcript) into normalized tokens: lowercase, no accents or punctuation, split
 * on whitespace, hyphens, dashes, and slashes, with numbers spelled out as words.
 */
export function tokenizeSpeechText(text: string): string[] {
    const tokens: string[] = [];
    const pieces: string[] = text
        .toLowerCase()
        .normalize("NFD")
        // Drop combining marks and apostrophes, so "Müller" -> "muller" and "don't" -> "dont"
        .replace(/[̀-ͯ'’]/g, "")
        // Digit-group commas ("10,000") aren't word separators
        .replace(/(\d),(?=\d{3})/g, "$1")
        // Everything else that isn't a letter, digit, or decimal point separates tokens
        .replace(/[^a-z0-9.]+/g, " ")
        .split(" ");

    for (const rawPiece of pieces) {
        // Keep periods only inside numbers ("3.5"); elsewhere they're abbreviations ("U.S.") or sentence ends
        const piece: string = rawPiece.replace(/^\.+|\.+$/g, "");
        if (piece === "") {
            continue;
        }

        const numberWords: string[] | undefined = spellOutNumber(piece);
        if (numberWords != undefined) {
            tokens.push(...numberWords);
            continue;
        }

        const word: string = piece.replace(/\./g, "");
        if (word !== "") {
            tokens.push(word);
        }
    }

    return tokens;
}

const ones: string[] = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
];

const tens: string[] = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const scales: [number, string][] = [
    [1e9, "billion"],
    [1e6, "million"],
    [1e3, "thousand"],
];

// Spells out a numeric token ("1848", "3.5", "19th", "1960s") as the words a reader would say, or returns
// undefined if the token isn't a number.
function spellOutNumber(token: string): string[] | undefined {
    const match: RegExpMatchArray | null = /^(\d+)(?:\.(\d+))?(st|nd|rd|th|s)?$/.exec(token);
    if (match == null || match[1].length > 12) {
        return undefined;
    }

    const value: number = parseInt(match[1], 10);
    const suffix: string | undefined = match[3];

    // Four-digit numbers are almost always years in quizbowl, which are read in pairs ("eighteen forty eight")
    let words: string[] =
        match[1].length === 4 && match[2] == undefined && isReadAsYear(value)
            ? yearToWords(value)
            : integerToWords(value);

    if (match[2] != undefined) {
        words.push("point", ...match[2].split("").map((digit) => ones[parseInt(digit, 10)]));
    } else if (suffix === "s") {
        words = [...words.slice(0, -1), pluralizeNumberWord(words[words.length - 1])];
    } else if (suffix != undefined) {
        words = [...words.slice(0, -1), ordinalOfNumberWord(words[words.length - 1])];
    }

    return words;
}

function isReadAsYear(value: number): boolean {
    return (value >= 1100 && value < 2000) || (value >= 2010 && value < 2100);
}

function yearToWords(value: number): string[] {
    const century: number = Math.floor(value / 100);
    const rest: number = value % 100;
    if (rest === 0) {
        return [...integerToWords(century), "hundred"];
    }

    // 1905 is read "nineteen oh five"
    return [...integerToWords(century), ...(rest < 10 ? ["oh"] : []), ...integerToWords(rest)];
}

function integerToWords(value: number): string[] {
    if (value < 20) {
        return [ones[value]];
    }

    if (value < 100) {
        const remainder: number = value % 10;
        return remainder === 0 ? [tens[Math.floor(value / 10)]] : [tens[Math.floor(value / 10)], ones[remainder]];
    }

    if (value < 1000) {
        const remainder: number = value % 100;
        return [ones[Math.floor(value / 100)], "hundred", ...(remainder === 0 ? [] : integerToWords(remainder))];
    }

    for (const [scale, name] of scales) {
        if (value >= scale) {
            const remainder: number = value % scale;
            return [
                ...integerToWords(Math.floor(value / scale)),
                name,
                ...(remainder === 0 ? [] : integerToWords(remainder)),
            ];
        }
    }

    return [String(value)];
}

const irregularOrdinals: Record<string, string> = {
    one: "first",
    two: "second",
    three: "third",
    five: "fifth",
    eight: "eighth",
    nine: "ninth",
    twelve: "twelfth",
};

function ordinalOfNumberWord(word: string): string {
    if (irregularOrdinals[word] != undefined) {
        return irregularOrdinals[word];
    }

    return word.endsWith("y") ? word.slice(0, -1) + "ieth" : word + "th";
}

function pluralizeNumberWord(word: string): string {
    if (word.endsWith("y")) {
        return word.slice(0, -1) + "ies";
    }

    return word.endsWith("x") ? word + "es" : word + "s";
}

// Words so common that matching one says little about where the reader is. They still count, just for less.
const stopWords: Set<string> = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "but",
    "by",
    "for",
    "from",
    "had",
    "has",
    "have",
    "he",
    "her",
    "his",
    "in",
    "into",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "she",
    "that",
    "the",
    "their",
    "these",
    "they",
    "this",
    "those",
    "to",
    "was",
    "were",
    "which",
    "who",
    "with",
]);

/**
 * How much a match on this token says about where the reader is. Long, distinctive words (names, technical
 * terms) are strong evidence; short and common words are weak. Words that appear several times in the tossup
 * ("this place") are discounted, since a match doesn't say which occurrence was read.
 */
export function getTokenWeight(token: string, occurrencesInText: number): number {
    const base: number = stopWords.has(token) ? 0.3 : token.length <= 3 ? 0.6 : token.length >= 7 ? 1.25 : 1;
    return base / Math.sqrt(Math.max(1, occurrencesInText));
}

/**
 * How alike a spoken token and a packet token are, from 0 (nothing alike) to 1 (identical). Tolerates the
 * misspellings recognizers make for words they half-know: small edit distances, similar sounds, and truncation.
 * Callers comparing many tokens can pass precomputed sound keys (see getSoundKey).
 */
export function getTokenSimilarity(
    spoken: string,
    target: string,
    spokenSoundKey?: string,
    targetSoundKey?: string
): number {
    if (spoken === target) {
        return 1;
    }

    const maximumLength: number = Math.max(spoken.length, target.length);
    const minimumLength: number = Math.min(spoken.length, target.length);

    // Words of very different lengths aren't the same word, however they're spelled
    if (minimumLength === 0 || minimumLength / maximumLength < 0.4) {
        return 0;
    }

    let similarity: number = 1 - getEditDistance(spoken, target) / maximumLength;

    // Short words ("in"/"on", "a"/"the") are too easily confused for sound or prefix matches to mean anything
    if (minimumLength >= 4) {
        // One being a prefix of the other: plurals, or the recognizer cutting a word short
        if ((spoken.startsWith(target) || target.startsWith(spoken)) && minimumLength / maximumLength >= 0.5) {
            similarity = Math.max(similarity, 0.8);
        }

        // Words that sound alike but are spelled differently ("Tchaikovsky"/"chaikovsky", "gray"/"grey")
        const spokenSound: string = spokenSoundKey ?? getSoundKey(spoken);
        const targetSound: string = targetSoundKey ?? getSoundKey(target);
        if (spokenSound.length >= 2 && targetSound.length >= 2) {
            const soundSimilarity: number =
                spokenSound === targetSound
                    ? 0.9
                    : 0.85 *
                      (1 -
                          getEditDistance(spokenSound, targetSound) / Math.max(spokenSound.length, targetSound.length));
            similarity = Math.max(similarity, soundSimilarity);
        }
    }

    return similarity;
}

/**
 * A rough phonetic key: spellings of the same sound are folded together, and vowels after the first letter are
 * dropped, since recognizers mostly get consonants right and vowels wrong on unfamiliar words.
 */
export function getSoundKey(word: string): string {
    const folded: string = word
        .replace(/^kn/, "n")
        .replace(/^wr/, "r")
        .replace(/^ps/, "s")
        .replace(/tch/g, "ch")
        .replace(/sch/g, "sk")
        .replace(/ph/g, "f")
        .replace(/gh/g, "")
        .replace(/ck/g, "k")
        .replace(/c(?=[eiy])/g, "s")
        .replace(/c/g, "k")
        .replace(/q/g, "k")
        .replace(/x/g, "ks")
        .replace(/z/g, "s")
        .replace(/v/g, "f")
        .replace(/dg/g, "j");

    let key: string = folded[0] ?? "";
    for (let i = 1; i < folded.length; i++) {
        const letter: string = folded[i];
        if ("aeiouyhw".includes(letter) || letter === key[key.length - 1]) {
            continue;
        }

        key += letter;
    }

    return key;
}

function getEditDistance(first: string, second: string): number {
    // Standard Levenshtein distance with two rows; words are short so this stays cheap
    let previousRow: number[] = [];
    for (let i = 0; i <= second.length; i++) {
        previousRow.push(i);
    }

    for (let i = 0; i < first.length; i++) {
        const currentRow: number[] = [i + 1];
        for (let j = 0; j < second.length; j++) {
            const substitutionCost: number = first[i] === second[j] ? 0 : 1;
            currentRow.push(Math.min(currentRow[j] + 1, previousRow[j + 1] + 1, previousRow[j] + substitutionCost));
        }

        previousRow = currentRow;
    }

    return previousRow[second.length];
}
