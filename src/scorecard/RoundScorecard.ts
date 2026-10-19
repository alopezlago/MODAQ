// Experimental: the moderator scorecard, computed from the timings RoundTiming.ts recorded. Describes, never
// grades: times and counts, with the few questions worth a second look. Reading items are left out when
// read-along heard too little of the round to be trusted.

import { IRoundTimingLog, IRoundTimingQuestion, TimedPosition } from "./RoundTiming";

// A gap longer than this between one question and the next is a break (a timeout, halftime), not dead air
const maximumGapBetweenQuestionsMs = 5 * 60 * 1000;

// Tossups read-along must have heard for its numbers to show
const minimumCoverage = 0.6;

// A pause in reading this long, mid-tossup, is listed
const longPauseMs = 2000;

// Commonly given for a bonus part. Rooms differ, so it's a reference line, not a rule
export const bonusPartReferenceMs = 5000;

// Answer waits on tossups past this are listed
const longTossupWaitMs = 5000;

// Reading that moves on this long after a buzz was recognized means the reader didn't stop
const keptReadingAfterMs = 1000;

export interface ITimedItem {
    // 1-based question number (the cycle) and the packet tossup it read
    question: number;
    ms: number;
    // Extra context: the word, the bonus part, the sentence
    detail?: string;
}

export interface ITimingSummary {
    count: number;
    medianMs?: number;
    averageMs?: number;
    totalMs?: number;
    longest: ITimedItem[];
}

export interface ISentencePace {
    question: number;
    sentence: number;
    words: number;
    ms: number;
    wordsPerSecond: number;
}

export interface IRoundScorecard {
    questionsShown: number;
    roundMs?: number;
    betweenQuestions: ITimingSummary;
    tossupAnswerWait: ITimingSummary;
    bonusPartWait: ITimingSummary & { overReference: number };
    rulingHeardToEntered: ITimingSummary;
    reading: IReadingScorecard | undefined;
    // Why reading items are missing, when they are
    readingHiddenBecause?: string;
}

export interface IReadingScorecard {
    coverage: number;
    tossupsHeard: number;
    wordsPerMinute?: number;
    // Pace in the second half of the round against the first (1.1 = 10% faster)
    paceDrift?: number;
    sentenceSeconds: ITimingSummary;
    sentenceWordsPerSecond?: number;
    // The last full sentence read before a buzz against the earlier ones, as words per second
    lastSentencePaceRatio?: number;
    slowestSentences: ISentencePace[];
    longPauses: ITimedItem[];
    keptReading: ITimedItem[];
    // Saved buzz word minus where read-along had the reader when the buzz came, in words
    buzzNudgeMedian?: number;
    buzzNudges: number;
}

export function buildRoundScorecard(log: IRoundTimingLog): IRoundScorecard {
    const questions: IRoundTimingQuestion[] = Object.values(log.questions).sort((a, b) => a.cycle - b.cycle);

    const lastActivity: number[] = questions.map(lastActivityOf);
    const roundMs: number | undefined =
        questions.length > 0 ? Math.max(...lastActivity) - Math.min(...questions.map((q) => q.shownAt)) : undefined;

    // Time between questions: the previous question's last activity to the reader starting the next one (its
    // first word heard, or the moderator moving to it when read-along heard nothing)
    const gaps: ITimedItem[] = [];
    for (let i = 1; i < questions.length; i++) {
        const previous: IRoundTimingQuestion = questions[i - 1];
        const next: IRoundTimingQuestion = questions[i];
        if (next.cycle !== previous.cycle + 1) {
            continue;
        }

        const start: number = startOf(next);
        const gap: number = start - lastActivity[i - 1];
        if (gap >= 0 && gap <= maximumGapBetweenQuestionsMs) {
            gaps.push({ question: next.cycle + 1, ms: gap });
        }
    }

    // Time given on tossups: the first recognition after the last ruling (or the start) to the ruling
    const tossupWaits: ITimedItem[] = [];
    const heardToEntered: ITimedItem[] = [];
    for (const question of questions) {
        let since: number = question.shownAt;
        for (const ruling of question.rulings) {
            const recognized: number | undefined = question.recognized.find((at) => at > since && at <= ruling.at);
            if (recognized != undefined) {
                tossupWaits.push({
                    question: question.cycle + 1,
                    ms: ruling.at - recognized,
                    detail: ruling.correct ? "correct" : "wrong",
                });
                const heard: number | undefined = question.heard.filter((at) => at > recognized && at <= ruling.at)[0];
                if (heard != undefined) {
                    heardToEntered.push({ question: question.cycle + 1, ms: ruling.at - heard });
                }
            }

            since = ruling.at;
        }
    }

    const bonusWaits: ITimedItem[] = [];
    questions.forEach((question, index) => {
        const next: IRoundTimingQuestion | undefined = questions[index + 1];
        bonusWaits.push(...bonusPartWaits(question, next != undefined ? startOf(next) : undefined));
    });

    const bonusSummary: ITimingSummary = summarize(bonusWaits, (item) => item.ms > bonusPartReferenceMs);
    const reading = buildReading(questions);

    return {
        questionsShown: questions.length,
        roundMs,
        betweenQuestions: summarize(gaps),
        tossupAnswerWait: summarize(tossupWaits, (item) => item.ms > longTossupWaitMs),
        bonusPartWait: {
            ...bonusSummary,
            overReference: bonusWaits.filter((item) => item.ms > bonusPartReferenceMs).length,
        },
        rulingHeardToEntered: summarize(heardToEntered),
        reading: reading.card,
        readingHiddenBecause: reading.hiddenBecause,
    };
}

// How long each bonus part was given: from read-along last placing the reader at the end of the part to the
// reader starting the next part. The last part runs to it being scored, or to the next question starting.
function bonusPartWaits(question: IRoundTimingQuestion, nextStart: number | undefined): ITimedItem[] {
    const bonus = question.bonus;
    if (bonus == undefined || bonus.parts.length === 0 || bonus.trace.length === 0) {
        return [];
    }

    const waits: ITimedItem[] = [];
    bonus.parts.forEach(([first, last], partIndex) => {
        // The end of a part: the last position heard within its final few words (recognizers often miss the very
        // last one)
        const ends: TimedPosition[] = bonus.trace.filter(
            ([, word]) => word >= Math.max(first, last - 2) && word <= last
        );
        if (ends.length === 0) {
            return;
        }

        const endedAt: number = ends[ends.length - 1][0];
        let resumedAt: number | undefined;
        const nextPart: [number, number] | undefined = bonus.parts[partIndex + 1];
        if (nextPart != undefined) {
            resumedAt = bonus.trace.find(([at, word]) => at > endedAt && word >= nextPart[0])?.[0];
        } else {
            const scored: number | null | undefined = bonus.scored[partIndex];
            const candidates: number[] = [scored ?? Infinity, nextStart ?? Infinity].filter(
                (at) => at > endedAt && at !== Infinity
            );
            resumedAt = candidates.length > 0 ? Math.min(...candidates) : undefined;
        }

        if (resumedAt != undefined && resumedAt - endedAt <= maximumGapBetweenQuestionsMs) {
            waits.push({ question: question.cycle + 1, ms: resumedAt - endedAt, detail: `part ${partIndex + 1}` });
        }
    });
    return waits;
}

function buildReading(
    questions: IRoundTimingQuestion[]
): { card: IReadingScorecard | undefined; hiddenBecause?: string } {
    const tossups: IRoundTimingQuestion[] = questions.filter((question) => question.words != undefined);
    if (tossups.length === 0) {
        return { card: undefined, hiddenBecause: "Read-along wasn't on, so there's nothing about reading." };
    }

    const heard: IRoundTimingQuestion[] = tossups.filter(wasHeard);
    const coverage: number = heard.length / tossups.length;
    if (coverage < minimumCoverage) {
        return {
            card: undefined,
            hiddenBecause: `Read-along heard only ${heard.length} of ${tossups.length} tossups well enough, so reading numbers would mislead. A closer microphone or a quieter room helps.`,
        };
    }

    const paces: { cycle: number; wpm: number }[] = [];
    const pauses: ITimedItem[] = [];
    const kept: ITimedItem[] = [];
    const sentences: ISentencePace[] = [];
    const lastSentenceRatios: number[] = [];
    const nudges: number[] = [];

    for (const question of heard) {
        const words: string[] = question.words ?? [];
        const firstRecognized: number | undefined = question.recognized.find((at) => at > question.shownAt);
        const reading: TimedPosition[] = question.trace.filter(
            ([at]) => firstRecognized == undefined || at <= firstRecognized
        );

        // Pace, over what was read before the first buzz
        if (reading.length >= 2) {
            const [startAt, startWord] = reading[0];
            const [endAt, endWord] = reading[reading.length - 1];
            if (endAt > startAt && endWord > startWord) {
                paces.push({ cycle: question.cycle, wpm: ((endWord - startWord) / (endAt - startAt)) * 60000 });
            }
        }

        for (let i = 1; i < reading.length; i++) {
            const gap: number = reading[i][0] - reading[i - 1][0];
            if (gap > longPauseMs) {
                const word: number = reading[i - 1][1];
                pauses.push({
                    question: question.cycle + 1,
                    ms: gap,
                    detail: `after “${words[word] ?? ""}” (word ${word + 1})`,
                });
            }
        }

        // Kept reading: the position moving well on, a second after each buzz was recognized, before its ruling
        let since: number = question.shownAt;
        for (const ruling of question.rulings) {
            const recognized: number | undefined = question.recognized.find((at) => at > since && at <= ruling.at);
            since = ruling.at;
            if (recognized == undefined) {
                continue;
            }

            const at: number | undefined = positionAt(question.trace, recognized);
            const later: TimedPosition | undefined = question.trace.find(
                ([time, word]) => time > recognized + keptReadingAfterMs && time < ruling.at && word > (at ?? -1) + 2
            );
            if (later != undefined && at != undefined) {
                kept.push({
                    question: question.cycle + 1,
                    ms: later[0] - recognized,
                    detail: `${later[1] - at} words on`,
                });
            }

            if (at != undefined) {
                nudges.push(ruling.position - at);
            }
        }

        // Sentence starts: when read-along first placed the reader in each sentence. A sentence counts once the
        // next one has started, before the first buzz
        const starts: number[] = sentenceStarts(words);
        const reachedAt: (number | undefined)[] = starts.map(
            (start) => reading.find(([, word]) => word >= start)?.[0]
        );
        const questionSentences: ISentencePace[] = [];
        for (let s = 0; s + 1 < starts.length; s++) {
            const from: number | undefined = reachedAt[s];
            const to: number | undefined = reachedAt[s + 1];
            if (from == undefined || to == undefined || to <= from) {
                continue;
            }

            const wordCount: number = starts[s + 1] - starts[s];
            questionSentences.push({
                question: question.cycle + 1,
                sentence: s + 1,
                words: wordCount,
                ms: to - from,
                wordsPerSecond: wordCount / ((to - from) / 1000),
            });
        }

        sentences.push(...questionSentences);
        if (questionSentences.length >= 3) {
            const last: ISentencePace = questionSentences[questionSentences.length - 1];
            const earlier: number[] = questionSentences.slice(0, -1).map((sentence) => sentence.wordsPerSecond);
            lastSentenceRatios.push(last.wordsPerSecond / median(earlier));
        }
    }

    const half: number = Math.floor(paces.length / 2);
    const firstHalf: number[] = paces.slice(0, half).map((pace) => pace.wpm);
    const secondHalf: number[] = paces.slice(half).map((pace) => pace.wpm);

    return {
        card: {
            coverage,
            tossupsHeard: heard.length,
            wordsPerMinute: paces.length > 0 ? median(paces.map((pace) => pace.wpm)) : undefined,
            paceDrift:
                firstHalf.length >= 3 && secondHalf.length >= 3 ? median(secondHalf) / median(firstHalf) : undefined,
            sentenceSeconds: summarize(sentences.map((s) => ({ question: s.question, ms: s.ms }))),
            sentenceWordsPerSecond:
                sentences.length > 0 ? median(sentences.map((sentence) => sentence.wordsPerSecond)) : undefined,
            lastSentencePaceRatio: lastSentenceRatios.length >= 3 ? median(lastSentenceRatios) : undefined,
            slowestSentences: sentences
                .filter((sentence) => sentence.words >= 4)
                .sort((a, b) => a.wordsPerSecond - b.wordsPerSecond)
                .slice(0, 3),
            longPauses: pauses.sort((a, b) => b.ms - a.ms).slice(0, 5),
            keptReading: kept,
            buzzNudgeMedian: nudges.length >= 3 ? median(nudges) : undefined,
            buzzNudges: nudges.length,
        },
    };
}

// Read-along heard a tossup if it followed a good share of what was read of it
function wasHeard(question: IRoundTimingQuestion): boolean {
    const wordCount: number = question.words?.length ?? 0;
    if (wordCount === 0 || question.trace.length < 5) {
        return false;
    }

    const firstRuling: number | undefined = question.rulings.find((ruling) => ruling.correct)?.position;
    const readUpTo: number = Math.min(wordCount, firstRuling != undefined ? firstRuling + 1 : wordCount);
    const reached: number = Math.max(...question.trace.map(([, word]) => word)) + 1;
    return reached >= readUpTo * 0.5;
}

/** Word indexes where each sentence starts: after a word ending in . ? or ! that isn't an abbreviation. */
export function sentenceStarts(words: string[]): number[] {
    const starts: number[] = words.length > 0 ? [0] : [];
    for (let i = 0; i + 1 < words.length; i++) {
        if (endsSentence(words[i], words[i + 1])) {
            starts.push(i + 1);
        }
    }

    return starts;
}

const abbreviations: ReadonlySet<string> = new Set([
    "mr",
    "mrs",
    "ms",
    "dr",
    "st",
    "mt",
    "ft",
    "jr",
    "sr",
    "vs",
    "no",
    "op",
    "ca",
    "c",
    "e.g",
    "i.e",
    "u.s",
    "u.k",
    "a.d",
    "b.c",
    "lt",
    "gen",
    "col",
    "capt",
    "sgt",
    "rev",
    "fr",
    "prof",
]);

function endsSentence(word: string, next: string): boolean {
    const stripped: string = word.replace(/["'”’)\]]+$/, "");
    if (!/[.?!]$/.test(stripped)) {
        return false;
    }

    if (/[?!]$/.test(stripped)) {
        return true;
    }

    const bare: string = stripped.slice(0, -1).replace(/^["'“‘(\[]+/, "").toLowerCase();
    // An initial ("J. S. Bach") or a known abbreviation
    if (/^[a-z]$/.test(bare) || abbreviations.has(bare)) {
        return false;
    }

    // A sentence starts with a capital, a digit or a quote
    return /^["'“‘(\[]?[A-Z0-9]/.test(next);
}

function startOf(question: IRoundTimingQuestion): number {
    const firstWord: number | undefined = question.trace[0]?.[0];
    return firstWord != undefined && firstWord >= question.shownAt ? firstWord : question.shownAt;
}

function lastActivityOf(question: IRoundTimingQuestion): number {
    const times: number[] = [
        question.shownAt,
        ...question.rulings.map((ruling) => ruling.at),
        ...(question.bonus?.scored.filter((at): at is number => at != undefined) ?? []),
        ...(question.bonus?.trace.map(([at]) => at) ?? []),
    ];
    // Reading the tossup counts only when nobody answered it: then the end of reading is where it went dead
    if (!question.rulings.some((ruling) => ruling.correct) && question.trace.length > 0) {
        times.push(question.trace[question.trace.length - 1][0]);
    }

    return Math.max(...times);
}

function positionAt(trace: TimedPosition[], at: number): number | undefined {
    let position: number | undefined;
    for (const [time, word] of trace) {
        if (time > at) {
            break;
        }

        position = word;
    }

    return position;
}

function summarize(items: ITimedItem[], listed?: (item: ITimedItem) => boolean): ITimingSummary {
    if (items.length === 0) {
        return { count: 0, longest: [] };
    }

    const values: number[] = items.map((item) => item.ms);
    const total: number = values.reduce((sum, value) => sum + value, 0);
    return {
        count: items.length,
        medianMs: median(values),
        averageMs: total / items.length,
        totalMs: total,
        longest: [...items]
            .filter((item) => listed == undefined || listed(item))
            .sort((a, b) => b.ms - a.ms)
            .slice(0, 3),
    };
}

function median(values: number[]): number {
    const sorted: number[] = [...values].sort((a, b) => a - b);
    const middle: number = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
