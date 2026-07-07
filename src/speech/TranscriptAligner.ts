// Skips within this distance are "ordinary": the recognizer dropped a few words. Beyond it, moving is a resync
// (the position fell badly behind, e.g. a stretch of misrecognized words), which needs more evidence.
const lookaheadWindow = 8;

// Short, common words ("on", "the", "a") appear everywhere, so only let them start a skip when they're right
// around where we expect the reader to be. Longer words can start a skip anywhere ahead, which is what lets the
// position resync when it falls far behind.
const shortWordLookaheadWindow = 3;
const shortWordLength = 4;

// How many consecutive spoken words have to match at a skipped-to location before the position moves there.
// Single words and short phrases ("this place", "this entity") repeat within questions, so small skips need two
// agreeing words, larger skips need three, and a long-range resync needs four.
const nearSkipRequiredWordCount = 2;
const farSkipRequiredWordCount = 3;
const resyncRequiredWordCount = 4;

// Skips of at most this distance count as "near" (e.g. the recognizer missing one word)
const nearSkipDistance = 2;

// Temporal expectations about a moderator reading aloud:
//  - They read at a bounded pace, so the position shouldn't suddenly jump much farther than they could have
//    read in the time elapsed. A jump that outpaces this needs extra corroboration (guards against a stray
//    far match yanking the position ahead).
//  - They don't dwell on a single word for many seconds. If the position has been stuck for a while but words
//    are still being heard, matching has fallen behind, so ease the bar to let it resync.
// A generous reading rate (typical is ~2.5-3) so genuine fast readers aren't penalized.
const assumedWordsPerSecond = 4;

// Allowance on top of the rate, for recognition bursts and brief pauses
const temporalSlackWords = 5;

// Extra agreeing words required to commit a jump that's farther than the time elapsed makes plausible
const temporalOverreachPenaltyWords = 2;

// After the position has been stuck this long, treat it as fallen-behind and ease the resync requirement
const stuckSeconds = 4;

// How many words behind (including the current position) to treat a spoken word as a repeat. Moderators
// stumble and re-read recent words, and speech recognizers re-emit parts of a sentence when they revise their
// guess. Questions also repeat phrases ("this place"), so a re-heard word from the current sentence must be
// treated as a repeat rather than matching the phrase's next occurrence. This check runs after the next-word
// check, so a large window doesn't stall normal reading.
const repeatWindow = 10;

/**
 * Follows along a known piece of text (the tossup) given an incoming stream of spoken words. The position only
 * moves forward, words are matched fuzzily to tolerate misrecognitions and mispronunciations, and recently read
 * words are treated as stumbles/repeats instead of new progress.
 */
export class TranscriptAligner {
    private readonly targetWords: string[];

    private position: number;

    // A candidate skip: a run of spoken words matching consecutively at a spot further ahead. The position only
    // moves there once enough words in a row agree.
    private pendingSkip: IPendingSkip | undefined;

    // Wall-clock time the position last advanced, for the temporal checks. 0 means it hasn't advanced yet.
    private lastProgressTime: number;

    // The last position confirmed via commit(). rollbackToCommitted() returns the aligner here, which lets a
    // caller advance the position on speculative (interim) words and then discard that advance if it isn't
    // borne out -- see ConfirmingTranscriptProcessor.
    private committedState: IAlignerState;

    constructor(targetWords: string[]) {
        this.targetWords = targetWords.map(normalizeSpokenWord);
        this.position = -1;
        this.pendingSkip = undefined;
        this.lastProgressTime = 0;
        this.committedState = { position: -1, pendingSkip: undefined, lastProgressTime: 0 };
    }

    /**
     * The index of the last word in the target text that we believe has been read, or -1 if none have been.
     */
    public get currentPosition(): number {
        return this.position;
    }

    /** Marks the current position as confirmed; a later rollbackToCommitted() returns the aligner here. */
    public commit(): void {
        this.committedState = {
            position: this.position,
            pendingSkip: this.pendingSkip == undefined ? undefined : { ...this.pendingSkip },
            lastProgressTime: this.lastProgressTime,
        };
    }

    /** Discards any advancement made since the last commit() (or since construction, if none). */
    public rollbackToCommitted(): void {
        this.position = this.committedState.position;
        this.pendingSkip =
            this.committedState.pendingSkip == undefined ? undefined : { ...this.committedState.pendingSkip };
        this.lastProgressTime = this.committedState.lastProgressTime;
    }

    /**
     * Processes more spoken words and returns the updated position. `now` is the current time in milliseconds;
     * it's a parameter so the temporal logic can be tested deterministically.
     */
    public processTranscript(transcript: string, now: number = Date.now()): number {
        for (const rawWord of transcript.split(/\s+/)) {
            const word: string = normalizeSpokenWord(rawWord);
            if (word !== "") {
                this.advance(word, now);
            }
        }

        return this.position;
    }

    private advance(word: string, now: number): void {
        // The most likely case: the word is the next one in the question
        const next: number = this.position + 1;
        if (next < this.targetWords.length && wordsMatch(word, this.targetWords[next])) {
            this.position = next;
            this.pendingSkip = undefined;
            this.lastProgressTime = now;
            return;
        }

        // If the word matches something just read, the moderator stumbled and repeated themselves, or the
        // recognizer re-emitted part of the sentence while revising its guess. Don't move the position, and
        // don't let it count as evidence for a pending skip; re-heard phrases also appear later in the question
        // ("this place"), and matching them ahead is how false jumps happen.
        const repeatStart: number = Math.max(0, this.position - repeatWindow + 1);
        for (let i = repeatStart; i <= this.position; i++) {
            if (wordsMatch(word, this.targetWords[i])) {
                return;
            }
        }

        // If a skip is pending and this word continues it, it's more evidence the reader is really there. Only
        // move once enough words in a row agree.
        if (
            this.pendingSkip != undefined &&
            this.pendingSkip.nextExpectedIndex < this.targetWords.length &&
            wordsMatch(word, this.targetWords[this.pendingSkip.nextExpectedIndex])
        ) {
            this.pendingSkip.matchedWordCount++;
            this.pendingSkip.nextExpectedIndex++;

            const requiredWordCount: number = this.requiredWordCountForSkip(this.pendingSkip.distance, now);
            if (this.pendingSkip.matchedWordCount >= requiredWordCount) {
                this.position = this.pendingSkip.nextExpectedIndex - 1;
                this.pendingSkip = undefined;
                this.lastProgressTime = now;
            }

            return;
        }

        // Look for the start of a skip: the recognizer may have missed words, or the position may have fallen
        // far behind after a stretch of misrecognitions. Longer words can start a skip anywhere in the rest of
        // the question (a far skip needs several consecutive matches anyway); short common words only nearby.
        // The position never moves on a single match; this just starts collecting evidence.
        const end: number =
            word.length < shortWordLength
                ? Math.min(this.targetWords.length, this.position + 1 + shortWordLookaheadWindow)
                : this.targetWords.length;
        for (let i = this.position + 2; i < end; i++) {
            if (wordsMatch(word, this.targetWords[i])) {
                this.pendingSkip = {
                    nextExpectedIndex: i + 1,
                    matchedWordCount: 1,
                    distance: i - this.position,
                };
                return;
            }
        }

        // No match anywhere; the word was misrecognized, part of a stumble, or unrelated speech. Clear any
        // pending skip, since the words after it didn't continue it.
        this.pendingSkip = undefined;
    }

    // How many consecutive agreeing words a skip of the given distance needs before the position moves there.
    // Starts from the distance-based requirement, then applies temporal expectations.
    private requiredWordCountForSkip(distance: number, now: number): number {
        let required: number =
            distance <= nearSkipDistance
                ? nearSkipRequiredWordCount
                : distance <= lookaheadWindow
                ? farSkipRequiredWordCount
                : resyncRequiredWordCount;

        // 0 means the position hasn't advanced yet (e.g. tracking started mid-question); don't constrain the
        // first sync by time.
        const secondsSinceProgress: number =
            this.lastProgressTime === 0 ? Number.POSITIVE_INFINITY : (now - this.lastProgressTime) / 1000;

        // A jump farther than the reader could have plausibly read in the elapsed time is suspect; demand more
        const plausibleWords: number = temporalSlackWords + secondsSinceProgress * assumedWordsPerSecond;
        if (distance > plausibleWords) {
            required += temporalOverreachPenaltyWords;
        }

        // The reader won't dwell on one word for seconds; if we've been stuck that long, matching has fallen
        // behind, so make it easier to catch up
        if (secondsSinceProgress >= stuckSeconds) {
            required = Math.max(nearSkipRequiredWordCount, required - 1);
        }

        return required;
    }
}

interface IPendingSkip {
    /** The next word index this skip expects to match */
    nextExpectedIndex: number;

    /** How many consecutive spoken words have matched at this skip so far */
    matchedWordCount: number;

    /** How far ahead of the position the skip started */
    distance: number;
}

// A snapshot of the aligner's mutable state, captured by commit() and restored by rollbackToCommitted().
interface IAlignerState {
    position: number;
    pendingSkip: IPendingSkip | undefined;
    lastProgressTime: number;
}

/**
 * Feeds an engine's growing/revisable utterance transcripts into a TranscriptAligner and reports the resulting
 * position. Implementations differ in how much they trust speculative (interim) transcripts.
 */
export interface ITranscriptProcessor {
    /** The aligner's current position. */
    readonly position: number;

    /**
     * Processes the latest transcript for an utterance. `isFinal` means the utterance is complete and the next
     * call belongs to a new utterance.
     */
    process(utteranceKey: string, transcript: string, isFinal: boolean): IProcessResult;
}

/**
 * Feeds growing/revisable utterance transcripts into a TranscriptAligner without double-counting words.
 * Speech recognizers emit partial transcripts that grow (and occasionally get revised) as the speaker keeps
 * talking, then a final transcript when the utterance ends. Each utterance is identified by a key; words
 * already consumed from the current utterance aren't fed to the aligner again.
 */
export class IncrementalTranscriptProcessor implements ITranscriptProcessor {
    private readonly aligner: TranscriptAligner;

    private currentUtteranceKey: string | undefined;

    private wordsConsumed: number;

    constructor(aligner: TranscriptAligner) {
        this.aligner = aligner;
        this.currentUtteranceKey = undefined;
        this.wordsConsumed = 0;
    }

    public get position(): number {
        return this.aligner.currentPosition;
    }

    /**
     * Processes the latest transcript for an utterance and returns the aligner's position along with the words
     * that hadn't been heard before this call. `isFinal` means the utterance is complete and the next call will
     * belong to a new utterance.
     */
    public process(utteranceKey: string, transcript: string, isFinal: boolean): IProcessResult {
        if (utteranceKey !== this.currentUtteranceKey) {
            this.currentUtteranceKey = utteranceKey;
            this.wordsConsumed = 0;
        }

        const words: string[] = transcript.split(/\s+/).filter((word) => word !== "");
        const newWords: string[] = words.slice(this.wordsConsumed);
        if (newWords.length > 0) {
            this.aligner.processTranscript(newWords.join(" "));
        }

        if (isFinal) {
            this.currentUtteranceKey = undefined;
            this.wordsConsumed = 0;
        } else {
            // If a revision shortened the transcript, keep the old count so re-added words aren't double-counted
            this.wordsConsumed = Math.max(this.wordsConsumed, words.length);
        }

        return {
            position: this.aligner.currentPosition,
            newWords,
        };
    }
}

/**
 * Like IncrementalTranscriptProcessor, but treats interim (non-final) transcripts as provisional: each
 * utterance is re-aligned from the last confirmed position, so a revised interim that no longer contains an
 * earlier (mis)guess pulls the position back instead of leaving it stuck forward. Only a finalized utterance --
 * or the start of the next utterance -- confirms the position. This guards against speculative interims (which
 * can run ahead of the audio, then get walked back) pinning the position past where the reader actually is.
 */
export class ConfirmingTranscriptProcessor implements ITranscriptProcessor {
    private readonly aligner: TranscriptAligner;

    private currentUtteranceKey: string | undefined;

    // Words already reported as "new" for the current utterance, so newWords stays a delta (for buzz-resolution
    // word detection) even though the position is recomputed from the whole utterance each call.
    private wordsReported: number;

    constructor(aligner: TranscriptAligner) {
        this.aligner = aligner;
        this.currentUtteranceKey = undefined;
        this.wordsReported = 0;
    }

    public get position(): number {
        return this.aligner.currentPosition;
    }

    public process(utteranceKey: string, transcript: string, isFinal: boolean): IProcessResult {
        if (utteranceKey !== this.currentUtteranceKey) {
            // A new utterance began; whatever the previous one settled on is now confirmed (its final may have
            // been missed, and the reader has moved on regardless).
            this.aligner.commit();
            this.currentUtteranceKey = utteranceKey;
            this.wordsReported = 0;
        }

        const words: string[] = transcript.split(/\s+/).filter((word) => word !== "");

        // Re-evaluate this utterance from the last confirmed position. Re-aligning the whole utterance each time
        // (rather than only its new words) is what lets a shortened/revised interim retract an earlier overshoot.
        this.aligner.rollbackToCommitted();
        if (words.length > 0) {
            this.aligner.processTranscript(words.join(" "));
        }

        const newWords: string[] = words.slice(this.wordsReported);
        this.wordsReported = Math.max(this.wordsReported, words.length);

        if (isFinal) {
            this.aligner.commit();
            this.currentUtteranceKey = undefined;
            this.wordsReported = 0;
        }

        return {
            position: this.aligner.currentPosition,
            newWords,
        };
    }
}

export interface IProcessResult {
    /** The aligner's position after processing */
    position: number;

    /** The words in this transcript that hadn't been processed before */
    newWords: string[];
}

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

function wordsMatch(spoken: string, target: string): boolean {
    if (spoken === target) {
        return true;
    }

    // Treat one word being a prefix of the other as a match (e.g. plurals, or the recognizer cutting a word short).
    // Require a few characters so short words like "a"/"an" don't match everything.
    const minimumLength: number = Math.min(spoken.length, target.length);
    if (minimumLength >= 4 && (spoken.startsWith(target) || target.startsWith(spoken))) {
        return true;
    }

    // Allow some misspellings/misrecognitions for longer words (e.g. recognizers write "gray" for "grey")
    const maximumLength: number = Math.max(spoken.length, target.length);
    if (maximumLength >= 4) {
        const maximumDistance: number = maximumLength >= 8 ? 2 : 1;
        return isWithinEditDistance(spoken, target, maximumDistance);
    }

    return false;
}

function isWithinEditDistance(first: string, second: string, maximumDistance: number): boolean {
    if (Math.abs(first.length - second.length) > maximumDistance) {
        return false;
    }

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

    return previousRow[second.length] <= maximumDistance;
}
