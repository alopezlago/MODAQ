import { getSoundKey, getTokenSimilarity, getTokenWeight, tokenizeSpeechText } from "./SpeechText";

export { normalizeSpokenWord } from "./SpeechText";

// How the aligner decides where the reader is
// ------------------------------------------
// Every time a word is heard, the most recent spoken tokens (the "window") are aligned against the tossup text
// with a fuzzy local alignment (Smith-Waterman): matches score by how alike the words are and how distinctive
// the packet word is, and the alignment can step over spoken words that don't match anything (misrecognitions,
// "um") or packet words the recognizer never reported. The column where the best alignment ends is where the
// window says the reader is.
//
// Aligning a window, instead of matching one word at a time, is what makes this robust: one misheard word no
// longer breaks a run of evidence, and a window of words read a few seconds ago that also appears later in the
// question ("this place") is explained by where it was actually read rather than pulling the position ahead.
//
// The position only moves forward when the alignment has enough evidence *past* the current position -- one
// word for the very next word, more for longer jumps, more still for jumps faster than anyone reads. Words the
// window explains at or behind the position (a stumble, a recognizer re-emitting part of a sentence) are not
// progress.

// How many of the most recently heard tokens are aligned against the text
const windowSize = 10;

// How far behind the position an alignment may start. Enough to cover a full window of words already read, plus
// some words the recognizer skipped.
const behindSearchTokens = 30;

// Spoken/target similarity below this is a mismatch; at or above, a match whose score scales with the similarity
const matchThreshold = 0.65;

// Score for a spoken token aligned with a packet token it doesn't match
const mismatchScore = -0.4;

// Cost of a spoken token the alignment skips (misrecognition, filler word, moderator aside)
const spokenGapCost = 0.4;

// Cost of skipping a packet token, i.e. assuming the recognizer missed it. Weak words are dropped by recognizers
// more often, and say less, so skipping them is cheaper.
const targetGapBaseCost = 0.15;
const targetGapWeightCost = 0.3;

// Evidence (the match score earned on words past the current position) needed to move there, by how far the move
// is. Any match moves to the very next word; skipping a word takes about one content word; longer skips need a
// couple of agreeing content words; resyncs far ahead need several.
const nextWordRequiredEvidence = 0.01;
const nearSkipDistance = 2;
const nearSkipRequiredEvidence = 0.9;
const farSkipDistance = 8;
const farSkipRequiredEvidence = 1.5;
const resyncRequiredEvidence = 2.6;

// A mild preference for nearer positions, so a phrase that repeats resolves to the nearer occurrence
const distancePenaltyPerToken = 0.03;

// Reading-pace expectations. A reader can't advance much faster than they speak, so a jump of more tokens than
// have been heard since the last progress needs extra evidence. The time-based allowance covers stretches where
// the recognizer reported nothing (e.g. a session restart), capped so a long silence doesn't make any jump free.
const allowedTokensPerHeardToken = 1.5;
const assumedTokensPerSecond = 4;
const maximumTimeAllowanceTokens = 25;
const baseAllowanceTokens = 4;
const overreachEvidencePerToken = 0.35;
const maximumOverreachEvidence = 4;

// If the recent window lines up strongly, right up to the newest word, with text well behind the position --
// much better than it lines up with the text around the position -- an earlier jump was wrong; move back. Kept
// strict so stumbles (which re-read only the last few words) never trigger it.
const recoveryMinimumDistance = 8;
const recoveryRequiredScore = 3.5;
const recoveryRequiredMarginOverPosition = 2;
const recoveryNearPositionTokens = 3;

// The spoken tokens a sound-alike similarity cache keeps before it's cleared
const similarityCacheLimit = 256;

// A word the recognizer split in two (or two words it joined into one) is only considered when the lengths are
// this close; otherwise a word that merely starts the pair ("gamma" for "gamma delta") would match it
const maximumJoinedLengthDifference = 2;

// How many tokens back from the end of an utterance a revision to its transcript is reprocessed
const maximumRevisionDepth = 30;

interface ITargetToken {
    text: string;

    soundKey: string;

    /** This token joined to the one before it, for when a recognizer writes two words as one */
    joinedWithPrevious: string | undefined;

    joinedWithPreviousSoundKey: string | undefined;

    /** Index of the buzzable word this token is part of */
    wordIndex: number;

    weight: number;
}

/**
 * The aligner's mutable state. It's a plain value so callers can snapshot and restore it, which is how revised
 * interim transcripts are replayed (see UtteranceTranscriptProcessor).
 */
export interface IAlignerState {
    /** Index into the target tokens of the last token believed read, or -1 */
    readonly tokenPosition: number;

    /** The most recently heard tokens, oldest first, at most windowSize of them */
    readonly recentTokens: readonly string[];

    /** Tokens heard since the position last moved */
    readonly tokensSinceProgress: number;

    /** Time (ms) the position last moved, or the aligner was created */
    readonly lastProgressTime: number;
}

/**
 * Follows along a known piece of text (the tossup) given an incoming stream of spoken words, reporting the index
 * of the last word read. Matching is fuzzy and windowed, so it tolerates misrecognitions, words the recognizer
 * drops, stumbles, and phrases that repeat within the question.
 */
export class TranscriptAligner {
    private readonly tokens: ITargetToken[];

    private state: IAlignerState;

    // Similarities of a spoken token (or two joined spoken tokens) to every target token, cached since each heard
    // token is compared against the text once per window it's in
    private readonly similarityCache: Map<string, ISpokenTokenSimilarities>;

    constructor(targetWords: string[], now: number = Date.now()) {
        this.tokens = tokenizeTargetWords(targetWords);
        this.state = { tokenPosition: -1, recentTokens: [], tokensSinceProgress: 0, lastProgressTime: now };
        this.similarityCache = new Map();
    }

    /**
     * The index of the last word in the target text that we believe has been read, or -1 if none have been.
     */
    public get currentPosition(): number {
        return this.state.tokenPosition < 0 ? -1 : this.tokens[this.state.tokenPosition].wordIndex;
    }

    public getState(): IAlignerState {
        return this.state;
    }

    public setState(state: IAlignerState): void {
        this.state = state;
    }

    /**
     * Processes more spoken words and returns the updated position. `now` is the current time in milliseconds;
     * it's a parameter so the temporal logic can be tested deterministically.
     */
    public processTranscript(transcript: string, now: number = Date.now()): number {
        for (const token of tokenizeSpeechText(transcript)) {
            this.processToken(token, now);
        }

        return this.currentPosition;
    }

    /** Processes one already-tokenized spoken token (see tokenizeSpeechText). */
    public processToken(token: string, now: number): void {
        const recentTokens: string[] = this.state.recentTokens.concat(token);
        if (recentTokens.length > windowSize) {
            recentTokens.shift();
        }

        const heardState: IAlignerState = {
            ...this.state,
            recentTokens,
            tokensSinceProgress: this.state.tokensSinceProgress + 1,
        };

        const newPosition: number = this.findPosition(heardState, now);
        this.state =
            newPosition === heardState.tokenPosition
                ? heardState
                : { tokenPosition: newPosition, recentTokens, tokensSinceProgress: 0, lastProgressTime: now };
    }

    private findPosition(state: IAlignerState, now: number): number {
        const spoken: readonly string[] = state.recentTokens;
        const position: number = state.tokenPosition;
        const start: number = Math.max(0, position - behindSearchTokens);
        const columnCount: number = this.tokens.length - start;
        if (columnCount <= 0 || spoken.length === 0) {
            return position;
        }

        const similarities: ISpokenTokenSimilarities[] = spoken.map((token) => this.getSimilarities(token));
        const endings: IAlignmentEnding[] = this.align(spoken, similarities, start, position);

        // Pick where to move. Forward candidates need enough evidence past the position, and have to explain the
        // window at least as well as staying put does.
        const allowance: number =
            baseAllowanceTokens +
            state.tokensSinceProgress * allowedTokensPerHeardToken +
            Math.min(
                maximumTimeAllowanceTokens,
                (Math.max(0, now - state.lastProgressTime) / 1000) * assumedTokensPerSecond
            );

        let bestStayScore = 0;
        let bestStayColumn = -1;
        let bestScoreNearPosition = 0;
        let bestForwardColumn = -1;
        let bestForwardAdjustedScore = Number.NEGATIVE_INFINITY;
        let bestForwardScore = 0;
        for (let column = 0; column < columnCount; column++) {
            const target: number = start + column;
            const ending: IAlignmentEnding = endings[column];
            if (ending.score <= 0) {
                continue;
            }

            if (target <= position) {
                if (ending.score > bestStayScore) {
                    bestStayScore = ending.score;
                    bestStayColumn = column;
                }

                if (target >= position - recoveryNearPositionTokens) {
                    bestScoreNearPosition = Math.max(bestScoreNearPosition, ending.score);
                }

                continue;
            }

            const distance: number = target - position;
            if (ending.progressEvidence < requiredEvidence(distance, allowance)) {
                continue;
            }

            const adjustedScore: number = ending.score - distance * distancePenaltyPerToken;
            if (adjustedScore > bestForwardAdjustedScore) {
                bestForwardAdjustedScore = adjustedScore;
                bestForwardColumn = column;
                bestForwardScore = ending.score;
            }
        }

        if (bestForwardColumn >= 0 && bestForwardScore >= bestStayScore) {
            return start + bestForwardColumn;
        }

        // Recovery from an earlier wrong jump: the latest words line up strongly, all the way to the newest word,
        // with text well behind the position, while nothing near the position is supported
        if (bestStayColumn >= 0) {
            const stayTarget: number = start + bestStayColumn;
            const stayEnding: IAlignmentEnding = endings[bestStayColumn];
            if (
                position - stayTarget >= recoveryMinimumDistance &&
                stayEnding.score >= recoveryRequiredScore &&
                stayEnding.endsAtNewestToken &&
                stayEnding.score - bestScoreNearPosition >= recoveryRequiredMarginOverPosition
            ) {
                return stayTarget;
            }
        }

        return position;
    }

    // Local alignment of the spoken window against target tokens [start, end). For each target column, returns the
    // best alignment ending there (allowing unexplained trailing spoken tokens at a cost), along with how much of
    // its score comes from target tokens past `position` -- the evidence that the reader has moved on.
    private align(
        spoken: readonly string[],
        similarities: ISpokenTokenSimilarities[],
        start: number,
        position: number
    ): IAlignmentEnding[] {
        const rows: number = spoken.length + 1;
        const columns: number = this.tokens.length - start + 1;
        const score: Float64Array = new Float64Array(rows * columns);
        const evidence: Float64Array = new Float64Array(rows * columns);
        const at = (row: number, column: number): number => row * columns + column;

        for (let row = 1; row < rows; row++) {
            const rowSimilarities: ISpokenTokenSimilarities = similarities[row - 1];
            const splitSimilarities: Float32Array | undefined =
                row >= 2 ? this.getSimilarities(spoken[row - 2] + spoken[row - 1]).single : undefined;
            for (let column = 1; column < columns; column++) {
                const target: number = start + column - 1;
                const token: ITargetToken = this.tokens[target];
                const isPastPosition: boolean = target > position;

                // Start fresh here (local alignment)
                let bestScore = 0;
                let bestEvidence = 0;

                // Spoken token aligned with this target token, as a match or a mismatch
                const pairScore: number = getPairScore(rowSimilarities.single[target], token.weight);
                const diagonal: number = score[at(row - 1, column - 1)] + pairScore;
                if (diagonal > bestScore) {
                    bestScore = diagonal;
                    bestEvidence = evidence[at(row - 1, column - 1)] + (isPastPosition ? pairScore : 0);
                }

                // Spoken token skipped
                const up: number = score[at(row - 1, column)] - spokenGapCost;
                if (up > bestScore) {
                    bestScore = up;
                    bestEvidence = evidence[at(row - 1, column)];
                }

                // Target token skipped (the recognizer missed it)
                const gapCost: number = targetGapBaseCost + targetGapWeightCost * Math.min(1, token.weight);
                const left: number = score[at(row, column - 1)] - gapCost;
                if (left > bestScore) {
                    bestScore = left;
                    bestEvidence = evidence[at(row, column - 1)];
                }

                // Two spoken tokens for one packet word: the recognizer split it ("photo electric")
                if (
                    splitSimilarities != undefined &&
                    token.text.length >= 5 &&
                    Math.abs(spoken[row - 2].length + spoken[row - 1].length - token.text.length) <=
                        maximumJoinedLengthDifference
                ) {
                    const mergedScore: number = getPairScore(splitSimilarities[target], token.weight);
                    const value: number = score[at(row - 2, column - 1)] + mergedScore;
                    if (mergedScore > 0 && value > bestScore) {
                        bestScore = value;
                        bestEvidence = evidence[at(row - 2, column - 1)] + (isPastPosition ? mergedScore : 0);
                    }
                }

                // One spoken token for two packet words: the recognizer joined them ("baseball" for "base ball")
                if (column >= 2 && spoken[row - 1].length >= 5) {
                    const mergedScore: number = getPairScore(
                        rowSimilarities.joinedTargets[target],
                        Math.max(this.tokens[target - 1].weight, token.weight)
                    );
                    const value: number = score[at(row - 1, column - 2)] + mergedScore;
                    if (mergedScore > 0 && value > bestScore) {
                        bestScore = value;
                        bestEvidence = evidence[at(row - 1, column - 2)] + (isPastPosition ? mergedScore : 0);
                    }
                }

                score[at(row, column)] = bestScore;
                evidence[at(row, column)] = bestEvidence;
            }
        }

        // For each target column, the best alignment ending there; spoken tokens after the alignment's end are
        // unexplained and cost the same as skipped spoken tokens
        const endings: IAlignmentEnding[] = [];
        for (let column = 1; column < columns; column++) {
            let best: IAlignmentEnding = { score: 0, progressEvidence: 0, endsAtNewestToken: false };
            for (let row = 1; row < rows; row++) {
                const trailingTokens: number = rows - 1 - row;
                const value: number = score[at(row, column)] - trailingTokens * spokenGapCost;
                if (value > best.score) {
                    best = {
                        score: value,
                        progressEvidence: evidence[at(row, column)],
                        endsAtNewestToken: trailingTokens === 0,
                    };
                }
            }

            endings.push(best);
        }

        return endings;
    }

    private getSimilarities(spokenToken: string): ISpokenTokenSimilarities {
        let similarities: ISpokenTokenSimilarities | undefined = this.similarityCache.get(spokenToken);
        if (similarities == undefined) {
            const soundKey: string = getSoundKey(spokenToken);
            similarities = {
                single: new Float32Array(this.tokens.length),
                joinedTargets: new Float32Array(this.tokens.length),
            };
            for (let i = 0; i < this.tokens.length; i++) {
                const token: ITargetToken = this.tokens[i];
                similarities.single[i] = getTokenSimilarity(spokenToken, token.text, soundKey, token.soundKey);
                if (
                    token.joinedWithPrevious != undefined &&
                    Math.abs(token.joinedWithPrevious.length - spokenToken.length) <= maximumJoinedLengthDifference
                ) {
                    similarities.joinedTargets[i] = getTokenSimilarity(
                        spokenToken,
                        token.joinedWithPrevious,
                        soundKey,
                        token.joinedWithPreviousSoundKey
                    );
                }
            }

            if (this.similarityCache.size >= similarityCacheLimit) {
                this.similarityCache.clear();
            }

            this.similarityCache.set(spokenToken, similarities);
        }

        return similarities;
    }
}

interface ISpokenTokenSimilarities {
    /** Similarity to each target token */
    single: Float32Array;

    /** Similarity to each target token joined to the one before it (0 for the first) */
    joinedTargets: Float32Array;
}

interface IAlignmentEnding {
    /** Score of the best alignment ending at this target token */
    score: number;

    /** The part of that score earned on target tokens past the current position */
    progressEvidence: number;

    /** Whether the alignment explains the window right up to the most recently heard token */
    endsAtNewestToken: boolean;
}

function getPairScore(similarity: number, weight: number): number {
    if (similarity < matchThreshold) {
        return mismatchScore;
    }

    // A match at the threshold earns a quarter of the word's weight; an exact match earns all of it
    return weight * (0.25 + (0.75 * (similarity - matchThreshold)) / (1 - matchThreshold));
}

function requiredEvidence(distance: number, allowance: number): number {
    const base: number =
        distance <= 1
            ? nextWordRequiredEvidence
            : distance <= nearSkipDistance
            ? nearSkipRequiredEvidence
            : distance <= farSkipDistance
            ? farSkipRequiredEvidence
            : resyncRequiredEvidence;

    // Moving faster than the reader could have read needs extra corroboration
    const overreach: number =
        distance > allowance
            ? Math.min(maximumOverreachEvidence, (distance - allowance) * overreachEvidencePerToken)
            : 0;

    return base + overreach;
}

function tokenizeTargetWords(targetWords: string[]): ITargetToken[] {
    const tokenTexts: { text: string; wordIndex: number }[] = [];
    targetWords.forEach((word, wordIndex) => {
        for (const text of tokenizeSpeechText(word)) {
            tokenTexts.push({ text, wordIndex });
        }
    });

    const occurrences: Map<string, number> = new Map();
    for (const token of tokenTexts) {
        occurrences.set(token.text, (occurrences.get(token.text) ?? 0) + 1);
    }

    return tokenTexts.map((token, index) => {
        const joinedWithPrevious: string | undefined = index > 0 ? tokenTexts[index - 1].text + token.text : undefined;
        return {
            ...token,
            soundKey: getSoundKey(token.text),
            joinedWithPrevious,
            joinedWithPreviousSoundKey: joinedWithPrevious == undefined ? undefined : getSoundKey(joinedWithPrevious),
            weight: getTokenWeight(token.text, occurrences.get(token.text) ?? 1),
        };
    });
}

/**
 * Feeds a speech engine's utterance transcripts into a TranscriptAligner. Recognizers emit partial transcripts
 * that grow -- and get revised -- while the speaker talks, then a final transcript when the utterance ends.
 *
 * Every transcript of an utterance is compared with the previous one: words in the unchanged prefix were already
 * processed, so processing resumes from the aligner state saved after that prefix. A revision that drops or
 * changes an earlier (mis)guess therefore undoes whatever that guess did to the position, while unchanged words
 * aren't reprocessed. A new utterance builds on wherever the previous one left the aligner.
 */
export class UtteranceTranscriptProcessor {
    private readonly aligner: TranscriptAligner;

    private currentUtteranceKey: string | undefined;

    // Tokens of the current utterance processed so far, and the aligner state after each prefix of them
    // (statesAfterTokens[0] is the state when the utterance began)
    private utteranceTokens: string[];

    private statesAfterTokens: IAlignerState[];

    // Words already reported as "new" for the current utterance, so newWords stays a delta (for buzz-resolution
    // word detection) even when the utterance is revised
    private wordsReported: number;

    constructor(aligner: TranscriptAligner) {
        this.aligner = aligner;
        this.currentUtteranceKey = undefined;
        this.utteranceTokens = [];
        this.statesAfterTokens = [aligner.getState()];
        this.wordsReported = 0;
    }

    public get position(): number {
        return this.aligner.currentPosition;
    }

    /**
     * Processes the latest transcript for an utterance. `isFinal` means the utterance is complete and the next
     * call belongs to a new utterance.
     */
    public process(
        utteranceKey: string,
        transcript: string,
        isFinal: boolean,
        now: number = Date.now()
    ): IProcessResult {
        if (utteranceKey !== this.currentUtteranceKey) {
            // A new utterance began; whatever the previous one settled on stands (its final may have been missed,
            // and the reader has moved on regardless)
            this.startUtterance(utteranceKey);
        }

        const tokens: string[] = tokenizeSpeechText(transcript);
        let commonPrefixLength = 0;
        while (
            commonPrefixLength < tokens.length &&
            commonPrefixLength < this.utteranceTokens.length &&
            tokens[commonPrefixLength] === this.utteranceTokens[commonPrefixLength]
        ) {
            commonPrefixLength++;
        }

        // Rewind to just after the unchanged prefix, then process what's new or revised. Revisions far behind the
        // end of a long utterance (Safari reports whole utterances as one growing transcript and keeps polishing
        // them) are too old to change where the reader is now, so don't rewind further than a few windows.
        const resumeIndex: number = Math.max(
            commonPrefixLength,
            Math.min(tokens.length, this.utteranceTokens.length) - maximumRevisionDepth
        );
        this.aligner.setState(this.statesAfterTokens[resumeIndex]);
        this.statesAfterTokens.length = resumeIndex + 1;
        for (let i = resumeIndex; i < tokens.length; i++) {
            this.aligner.processToken(tokens[i], now);
            this.statesAfterTokens.push(this.aligner.getState());
        }

        this.utteranceTokens = tokens;

        const words: string[] = transcript.split(/\s+/).filter((word) => word !== "");
        const newWords: string[] = words.slice(this.wordsReported);
        this.wordsReported = Math.max(this.wordsReported, words.length);

        if (isFinal) {
            this.currentUtteranceKey = undefined;
            this.utteranceTokens = [];
            this.statesAfterTokens = [this.aligner.getState()];
            this.wordsReported = 0;
        }

        return {
            position: this.aligner.currentPosition,
            newWords,
        };
    }

    private startUtterance(utteranceKey: string): void {
        this.currentUtteranceKey = utteranceKey;
        this.utteranceTokens = [];
        this.statesAfterTokens = [this.aligner.getState()];
        this.wordsReported = 0;
    }
}

export interface IProcessResult {
    /** The aligner's position after processing */
    position: number;

    /** The words in this transcript that hadn't been processed before */
    newWords: string[];
}
