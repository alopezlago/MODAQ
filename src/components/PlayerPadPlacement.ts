/**
 * Where the player pad goes when it opens on a word: right next to the buzz point, but never over the word itself.
 * The pad repeats the tossup's answer, so it's free to cover the answer on the page.
 *
 * In order of preference:
 * 1. just below the word, if the pad fits in the window there;
 * 2. just above the word, if it fits there;
 * 3. on whichever side of the word has more room (the window may need scrolling to see all of it).
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
    pad: IPadSize;
    viewport: IPadSize;
    // The horizontal span the pad must stay within (defaults to the window)
    horizontalBounds?: { left: number; right: number };
    gap?: number;
    margin?: number;
}

export type PadPlacement = "belowWord" | "aboveWord";

export interface IPadPosition {
    left: number;
    top: number;
    placement: PadPlacement;
}

export function choosePadPosition(input: IPadPlacementInput): IPadPosition {
    const gap: number = input.gap ?? 6;
    const margin: number = input.margin ?? 8;
    const { word, pad, viewport } = input;
    const bounds = input.horizontalBounds ?? { left: 0, right: viewport.width };

    // Start at the word; keep the whole pad inside the bounds (its left edge wins if it can't fit at all)
    const minLeft: number = bounds.left + margin;
    const maxLeft: number = bounds.right - margin - pad.width;
    const left: number = Math.max(minLeft, Math.min(word.left, maxLeft));

    const belowTop: number = word.bottom + gap;
    const aboveTop: number = word.top - gap - pad.height;
    const fitsBelow: boolean = belowTop + pad.height <= viewport.height;
    const fitsAbove: boolean = aboveTop >= 0;

    if (fitsBelow) {
        return { left, top: belowTop, placement: "belowWord" };
    }

    if (fitsAbove) {
        return { left, top: aboveTop, placement: "aboveWord" };
    }

    // Fits on neither side: take the roomier one
    const roomBelow: number = viewport.height - belowTop;
    const roomAbove: number = word.top - gap;
    return roomBelow >= roomAbove
        ? { left, top: belowTop, placement: "belowWord" }
        : { left, top: aboveTop, placement: "aboveWord" };
}
