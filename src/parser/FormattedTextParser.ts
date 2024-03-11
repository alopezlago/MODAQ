import { IFormattedText } from "./IFormattedText";

export function parseFormattedText(text: string, pronunciationGuideMarkers?: [string, string]): IFormattedText[] {
    const result: IFormattedText[] = [];

    if (text == undefined) {
        return result;
    }

    let bolded = false;
    let emphasized = false;
    let underlined = false;
    let subscripted = false;
    let superscripted = false;
    let pronunciation = false;
    let startIndex = 0;

    // If we need to support older browswers, use RegExp, exec, and a while loop. See
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll
    const matchIterator: IterableIterator<RegExpMatchArray> =
        pronunciationGuideMarkers == undefined
            ? text.matchAll(/<\/?em>|<\/?req>|<\/?b>|<\/?u>|<\/?sub>|<\/?sup>/gi)
            : text.matchAll(
                  new RegExp(
                      `<\\/?em>|<\\/?req>|<\\/?b>|<\\/?u>|<\\/?sub>|<\\/?sup>|${escapeRegExp(
                          pronunciationGuideMarkers[0]
                      )}|${escapeRegExp(pronunciationGuideMarkers[1])}`,
                      "gi"
                  )
              );

    for (const match of matchIterator) {
        // For the end of the pronunciation guide, we want to include it in the string, so add it to the current slice
        const tagInTextLength: number =
            pronunciationGuideMarkers != undefined && match[0].toLowerCase() === pronunciationGuideMarkers[1]
                ? pronunciationGuideMarkers[1].length
                : 0;
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
        const tag: string = match[0];
        let skipTag = true;
        switch (tag.toLowerCase()) {
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
                if (pronunciationGuideMarkers) {
                    if (tag === pronunciationGuideMarkers[0].toLowerCase()) {
                        skipTag = false;
                        pronunciation = true;
                        break;
                    } else if (tag === pronunciationGuideMarkers[1].toLowerCase()) {
                        pronunciation = false;
                        break;
                    }
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
export function splitFormattedTextIntoWords(
    text: string,
    pronunciationGuideMarkers?: [string, string]
): IFormattedText[][] {
    // We need to take the list of formatted text and split them up into individual words.
    // Algorithm: For each piece of formatted text, go through and split the text by the spaces in it.
    // If there are no spaces, then add it to a variable tracking the last word.
    // If there are spaces, add the last word to the list, and then add each non-empty segment (i.e. non-space) to the
    // list, except for the last one. If the last segment isn't empty, set that as the "last word", and continue going
    // through the list of formatted texts.
    const formattedText: IFormattedText[] = parseFormattedText(text, pronunciationGuideMarkers);

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
