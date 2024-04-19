import { IFormattedText } from "./IFormattedText";

/**
 * Default pronunciation guide markers used if none are passed into `IFormattingOptions`
 */
export const defaultPronunciationGuideMarkers: [string, string] = ["(", ")"];

/**
 * Default reader directives used if none are passed into `IFormattingOptions`
 */
export const defaultReaderDirectives: string[] = [
    "(emphasize)",
    "(pause)",
    "(read slowly)",
    "[emphasize]",
    "[pause]",
    "[read slowly]",
];

/**
 * Options for how to parse and format text
 */
export interface IFormattingOptions {
    /**
     * Two-element array where the first string is the tag for the start of a pronunciation guide and the second string
     * is the tag for the end. For example, if the pronuncation guide looks like "(guide)", the array would be
     * [ "(", ")" ]. Pronunciation guides don't count as words and are formatted differently from the rest of the
     * question text.
     * If no value is provided, then `defaultPronunciationGuideMarkers` will be used.
     */
    pronunciationGuideMarkers?: [string, string];

    /**
     * Directives for the reader, like "(read slowly)". These don't count as words and are formatted differently from
     * the rest of the question text.
     * If no value is provided, then `defaultReaderDirectives` will be used.
     */
    readerDirectives?: string[];
}

/**
 * Takes text with formatting tags and turns it into an array of texts with formatting information included, such as
 * which words are bolded.
 * Note that if the '"' character is used in a pronunciation guide, it will also support '“' and '”', and vice versa.
 * @param text The text to format, such a question or answerline.
 * @param options Formtating options, such as what indicates the start of a pronunciation guide.
 * @returns An array of `IFormattedText` that represents the text with formatting metadata, such as which words are
 * bolded, underlined, etc.
 */
export function parseFormattedText(text: string, options?: IFormattingOptions): IFormattedText[] {
    const result: IFormattedText[] = [];

    if (text == undefined) {
        return result;
    }

    options = options ?? {};
    const pronunciationGuideMarkers: [[string, string]] = [
        options.pronunciationGuideMarkers ?? defaultPronunciationGuideMarkers,
    ];

    // Normalize quotes in pronunciation guides
    if (pronunciationGuideMarkers[0][0].includes('"') || pronunciationGuideMarkers[0][1].includes('"')) {
        pronunciationGuideMarkers.push([
            pronunciationGuideMarkers[0][0].replace(/"/g, "“"),
            pronunciationGuideMarkers[0][1].replace(/"/g, "”"),
        ]);
    }

    if (pronunciationGuideMarkers[0][0].includes("“") || pronunciationGuideMarkers[0][1].includes("”")) {
        pronunciationGuideMarkers.push([
            pronunciationGuideMarkers[0][0].replace(/“/g, '"'),
            pronunciationGuideMarkers[0][1].replace(/”/g, '"'),
        ]);
    }

    const readerDirectives: string[] | undefined = options.readerDirectives ?? defaultReaderDirectives;

    let bolded = false;
    let emphasized = false;
    let underlined = false;
    let subscripted = false;
    let superscripted = false;
    let pronunciation = false;
    let startIndex = 0;

    let extraTags = "";
    for (const pronunciationGuideMarker of pronunciationGuideMarkers) {
        extraTags += `|${escapeRegExp(pronunciationGuideMarker[0])}|${escapeRegExp(pronunciationGuideMarker[1])}`;
    }

    if (readerDirectives) {
        extraTags += `|${readerDirectives.map((directive) => escapeRegExp(directive)).join("|")}`;
    }

    // If we need to support older browswers, use RegExp, exec, and a while loop. See
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll
    const matchIterator: IterableIterator<RegExpMatchArray> = text.matchAll(
        new RegExp(`<\\/?em>|<\\/?req>|<\\/?b>|<\\/?u>|<\\/?sub>|<\\/?sup>${extraTags}`, "gi")
    );

    for (const match of matchIterator) {
        // For the end of the pronunciation guide, we want to include it in the string, so add it to the current slice
        // TODO: Do we need to do this with reader directives?
        const tag: string = match[0];
        const normalizedTag: string = tag.toLowerCase();
        let tagInTextLength = 0;
        for (const pronunciationGuideMarker of pronunciationGuideMarkers) {
            if (normalizedTag === pronunciationGuideMarker[1].toLowerCase()) {
                tagInTextLength = pronunciationGuideMarker[1].length;
                break;
            }
        }

        const matchIndex: number = match.index ?? 0;

        const slice: string = text.substring(startIndex, matchIndex + tagInTextLength);
        if (slice.length > 0) {
            const formattedSlice: IFormattedText = {
                text: text.substring(startIndex, matchIndex + tagInTextLength),
                bolded,
                emphasized,
                underlined,
                subscripted,
                superscripted,
                pronunciation,
            };
            result.push(formattedSlice);
        }

        // Once we got the slice of text, toggle the attribute for the next slice
        let skipTag = true;
        switch (normalizedTag) {
            case "<em>":
                emphasized = true;
                break;
            case "</em>":
                emphasized = false;
                break;
            case "<req>":
                bolded = true;
                underlined = true;
                break;
            case "</req>":
                bolded = false;
                underlined = false;
                break;
            case "<b>":
                bolded = true;
                break;
            case "</b>":
                bolded = false;
                break;
            case "<u>":
                underlined = true;
                break;
            case "</u>":
                underlined = false;
                break;
            case "<sub>":
                subscripted = true;
                break;
            case "</sub>":
                subscripted = false;
                break;
            case "<sup>":
                superscripted = true;
                break;
            case "</sup>":
                superscripted = false;
                break;
            default:
                let pronunciationGuideMatched = false;
                for (const pronunciationGuideMarker of pronunciationGuideMarkers) {
                    if (normalizedTag === pronunciationGuideMarker[0].toLowerCase()) {
                        skipTag = false;
                        pronunciation = true;
                        pronunciationGuideMatched = true;
                    } else if (normalizedTag === pronunciationGuideMarker[1].toLowerCase()) {
                        pronunciation = false;
                        pronunciationGuideMatched = true;
                    }
                }

                if (pronunciationGuideMatched) {
                    break;
                }

                if (readerDirectives.some((directive) => directive.trim().toLowerCase() === normalizedTag)) {
                    // Treat it like a pronunciation guide for this one specific word
                    const readerDirectiveText: IFormattedText = {
                        text: tag,
                        bolded,
                        emphasized,
                        underlined,
                        subscripted,
                        superscripted,
                        pronunciation: true,
                    };
                    result.push(readerDirectiveText);
                    break;
                }

                throw `Unknown match: ${tag}`;
        }

        // Skip the tag, since we don't want it in the text. In some cases we want it (start of pronunciation guide), so
        // don't skip it in those cases.
        if (skipTag) {
            startIndex = matchIndex + tag.length;
        } else {
            startIndex = matchIndex;
        }
    }

    if (startIndex < text.length) {
        result.push({
            text: text.substring(startIndex),
            bolded,
            emphasized,
            underlined,
            subscripted,
            superscripted,
            pronunciation,
        });
    }

    return result;
}

// TODO: Look into removing the dependency with parseFormattedText, so that we only do one pass over the string instead
// of two passes.
/**
 * Takes text with formatting tags and splits it into an array of words with formatting information for each word.
 * @param text The text to format, such a question or answerline.
 * @param options Formtating options, such as what indicates the start of a pronunciation guide.
 * @returns An array of words represented as an `IFormattedText[]` representing all the formatting in that word.
 */
export function splitFormattedTextIntoWords(text: string, options?: IFormattingOptions): IFormattedText[][] {
    // We need to take the list of formatted text and split them up into individual words.
    // Algorithm: For each piece of formatted text, go through and split the text by the spaces in it.
    // If there are no spaces, then add it to a variable tracking the last word.
    // If there are spaces, add the last word to the list, and then add each non-empty segment (i.e. non-space) to the
    // list, except for the last one. If the last segment isn't empty, set that as the "last word", and continue going
    // through the list of formatted texts.
    const formattedText: IFormattedText[] = parseFormattedText(text, options);

    const splitFormattedText: IFormattedText[][] = [];

    let previousWord: IFormattedText[] = [];
    for (const value of formattedText) {
        // If we need to worry about mulitiline, we can use /\s/mg instead
        const words: string[] = value.text.split(/\s+/g);
        if (words.length === 1) {
            // No spaces in this span. This value to last.
            previousWord.push(value);
            continue;
        }

        // There's a space in this formatted text, so find it, and combine the segments before it into the previous word
        // and place the previous word into the list.
        const firstWord = words[0];
        if (firstWord.length === 0) {
            splitFormattedText.push(previousWord);
        } else {
            previousWord.push({
                text: firstWord,
                bolded: value.bolded,
                emphasized: value.emphasized,
                underlined: value.underlined,
                subscripted: value.subscripted,
                superscripted: value.superscripted,
                pronunciation: value.pronunciation,
            });
            splitFormattedText.push(previousWord);
        }

        previousWord = [];

        const lastSegmentIndex: number = words.length - 1;
        for (let i = 1; i < lastSegmentIndex; i++) {
            const word = words[i];
            // Skip spaces. We'll add a space back in later.
            if (word.length > 0) {
                const formattedWord: IFormattedText = {
                    text: word,
                    bolded: value.bolded,
                    emphasized: value.emphasized,
                    underlined: value.underlined,
                    subscripted: value.subscripted,
                    superscripted: value.superscripted,
                    pronunciation: value.pronunciation,
                };
                splitFormattedText.push([formattedWord]);
            }
        }

        const lastSegment: string = words[lastSegmentIndex];
        if (lastSegment.length > 0) {
            previousWord.push({
                text: lastSegment,
                bolded: value.bolded,
                emphasized: value.emphasized,
                underlined: value.underlined,
                subscripted: value.subscripted,
                superscripted: value.superscripted,
                pronunciation: value.pronunciation,
            });
        }
    }

    // There are no more segments, so this is the last word.
    if (previousWord.length > 0) {
        splitFormattedText.push(previousWord);
    }

    return splitFormattedText;
}

// Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
