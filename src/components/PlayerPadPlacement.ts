/**
 * Where the player pad goes when it opens on a word: close to the buzz point, but never over the tossup's answer
 * (the moderator reads it while judging) and never over the word itself.
 *
 * In order of preference:
 * 1. just below the word, if the pad fits in the window there and stays clear of the answer;
 * 2. just above the word, on the same two conditions;
 * 3. just below the answer, where it can't cover either (the window may need scrolling to see all of it).
 *
 * Horizontally the pad starts at the word and is kept inside the allowed span (the window, or the question column
 * for the compact pad). Pure, so the decision can be tested without a browser.
 */

export interface IPadRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface IPadSize {
    width: number;
    height: number;
}

export interface IPadPlacementInput {
    word: IPadRect;
    // The answer line and the metadata under it; undefined when it isn't on the page
    answer: IPadRect | undefined;
    pad: IPadSize;
    viewport: IPadSize;
    // The horizontal span the pad must stay within (defaults to the window)
    horizontalBounds?: { left: number; right: number };
    gap?: number;
    margin?: number;
}

export type PadPlacement = "belowWord" | "aboveWord" | "belowAnswer";

export interface IPadPosition {
    left: number;
    top: number;
    placement: PadPlacement;
}

export function choosePadPosition(input: IPadPlacementInput): IPadPosition {
    const gap: number = input.gap ?? 6;
    const margin: number = input.margin ?? 8;
    const { word, answer, pad, viewport } = input;
    const bounds = input.horizontalBounds ?? { left: 0, right: viewport.width };

    // Start at the word; keep the whole pad inside the bounds (its left edge wins if it can't fit at all)
    const minLeft: number = bounds.left + margin;
    const maxLeft: number = bounds.right - margin - pad.width;
    const left: number = Math.max(minLeft, Math.min(word.left, maxLeft));

    const rectAt = (top: number): IPadRect => ({ left, top, right: left + pad.width, bottom: top + pad.height });
    const fitsWindow = (r: IPadRect): boolean => r.top >= 0 && r.bottom <= viewport.height;
    const clearOfAnswer = (r: IPadRect): boolean => answer == undefined || !intersects(r, answer);

    const below: IPadRect = rectAt(word.bottom + gap);
    if (fitsWindow(below) && clearOfAnswer(below)) {
        return { left, top: below.top, placement: "belowWord" };
    }

    const above: IPadRect = rectAt(word.top - gap - pad.height);
    if (fitsWindow(above) && clearOfAnswer(above)) {
        return { left, top: above.top, placement: "aboveWord" };
    }

    // Nowhere near the word works: under the answer (or, with no answer on the page, under the word), even if that
    // runs past the window
    const under: number = answer != undefined ? Math.max(answer.bottom, word.bottom) + gap : below.top;
    return { left, top: under, placement: "belowAnswer" };
}

function intersects(a: IPadRect, b: IPadRect): boolean {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
