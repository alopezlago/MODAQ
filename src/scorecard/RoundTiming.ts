// Experimental: the timings behind a moderator's post-round scorecard. Off unless the moderator turns on the
// scorecard (Options) and the host gives the game a key to file timings under.
//
// Only word numbers and times are kept -- never audio or transcripts -- and only in this browser (localStorage,
// under the host's key), so a reload mid-round doesn't lose what was recorded.
//
// What's recorded, per question (cycle):
//   - when it was first shown;
//   - read-along's position over time on the tossup, and (when the bonus is on screen with it) on the bonus;
//   - where each tossup sentence starts, and each bonus part's words;
//   - when a buzz was recognized (the host's buzzer, Space, or the buzz menu opening), when each ruling was entered
//     and on which word, when a ruling word ("correct", "neg") was heard, and when each bonus part was scored.
// RoundScorecard.ts turns this into the card.

const storagePrefix = "modaq-round-timing:";

// Positions and times kept per question are capped, so a stuck recognizer can't fill localStorage
const maximumTraceEntries = 600;

export type TimedPosition = [at: number, wordIndex: number];

export interface IRoundTimingRuling {
    at: number;
    correct: boolean;
    // The word the buzz was saved on (MODAQ's marker position)
    position: number;
}

export interface IRoundTimingBonus {
    // [first word, last word] of each part, as indexes into the words followed for the bonus (leadin first)
    parts: [number, number][];
    trace: TimedPosition[];
    // When each part was last marked (right, or set back to wrong), by part
    scored: (number | null)[];
}

export interface IRoundTimingQuestion {
    cycle: number;
    // 1-based tossup number in the packet
    tossup: number;
    shownAt: number;
    // Words read-along followed on the tossup (MODAQ's buzzable words, without the end marker)
    words?: string[];
    trace: TimedPosition[];
    recognized: number[];
    rulings: IRoundTimingRuling[];
    heard: number[];
    bonus?: IRoundTimingBonus;
}

export interface IRoundTimingLog {
    v: 1;
    key: string;
    startedAt: number;
    // By cycle index
    questions: Record<number, IRoundTimingQuestion>;
}

let enabled = false;
let currentKey: string | undefined;
let log: IRoundTimingLog | undefined;
let currentCycle: number | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

// Lets tests run without the clock
let now: () => number = () => Date.now();
export function setRoundTimingClock(clock: () => number): void {
    now = clock;
}

/** Turns recording on or off, filing under `key` (no key: nothing is recorded). */
export function configureRoundTiming(isEnabled: boolean, key: string | undefined): void {
    if (key !== currentKey) {
        flush();
        currentKey = key;
        log = undefined;
        currentCycle = undefined;
    }

    enabled = isEnabled && key != undefined;
}

export function isRoundTimingActive(): boolean {
    return enabled;
}

/** The timings recorded under `key` (this game's, by default), or undefined if there are none. */
export function getRoundTiming(key: string | undefined = currentKey): IRoundTimingLog | undefined {
    if (key == undefined) {
        return undefined;
    }

    if (key === currentKey && log != undefined) {
        return log;
    }

    return load(key);
}

export function clearRoundTiming(key: string): void {
    if (key === currentKey) {
        log = undefined;
        currentCycle = undefined;
    }

    try {
        localStorage.removeItem(storagePrefix + key);
    } catch {
        // Nothing to clear
    }
}

/** The moderator is on this question (called whenever the cycle on screen changes). */
export function recordQuestionShown(cycle: number, tossupNumber: number): void {
    const active: IRoundTimingLog | undefined = activeLog();
    if (active == undefined) {
        return;
    }

    currentCycle = cycle;
    if (active.questions[cycle] == undefined) {
        active.questions[cycle] = {
            cycle,
            tossup: tossupNumber,
            shownAt: now(),
            trace: [],
            recognized: [],
            rulings: [],
            heard: [],
        };
        save();
    }
}

/** Read-along is following these tossup words on the question on screen. */
export function recordTossupWords(words: string[]): void {
    const question: IRoundTimingQuestion | undefined = currentQuestion();
    if (question == undefined) {
        return;
    }

    question.words = words;
    save();
}

/** Read-along is following this bonus: the leadin and each part's words, in order. */
export function recordBonusWords(leadinWordCount: number, partWordCounts: number[]): void {
    const question: IRoundTimingQuestion | undefined = currentQuestion();
    if (question == undefined || question.bonus != undefined) {
        return;
    }

    const parts: [number, number][] = [];
    let start: number = leadinWordCount;
    for (const count of partWordCounts) {
        parts.push([start, start + Math.max(0, count - 1)]);
        start += count;
    }

    question.bonus = { parts, trace: [], scored: partWordCounts.map(() => null) };
    save();
}

/** Read-along's position moved (on the tossup, or on the bonus when it's following one). */
export function recordReaderPosition(kind: "tossup" | "bonus", wordIndex: number): void {
    const question: IRoundTimingQuestion | undefined = currentQuestion();
    if (question == undefined || wordIndex < 0) {
        return;
    }

    const trace: TimedPosition[] | undefined = kind === "tossup" ? question.trace : question.bonus?.trace;
    if (trace == undefined || trace.length >= maximumTraceEntries) {
        return;
    }

    const last: TimedPosition | undefined = trace[trace.length - 1];
    if (last != undefined && last[1] === wordIndex) {
        return;
    }

    trace.push([now(), wordIndex]);
    save();
}

/** A buzz was recognized: the host's buzzer has someone in, Space was pressed, or the buzz menu opened. */
export function recordBuzzRecognized(): void {
    pushTime((question) => question.recognized);
}

/** A ruling word ("correct", "neg", "ten") was heard on the microphone. */
export function recordRulingHeard(): void {
    pushTime((question) => question.heard);
}

export function recordRuling(correct: boolean, position: number): void {
    const question: IRoundTimingQuestion | undefined = currentQuestion();
    if (question == undefined || question.rulings.length >= maximumTraceEntries) {
        return;
    }

    question.rulings.push({ at: now(), correct, position });
    save();
}

export function recordBonusPartScored(partIndex: number): void {
    const question: IRoundTimingQuestion | undefined = currentQuestion();
    if (question == undefined) {
        return;
    }

    if (question.bonus == undefined) {
        // Scored without read-along following the bonus: still worth knowing when
        question.bonus = { parts: [], trace: [], scored: [] };
    }

    question.bonus.scored[partIndex] = now();
    save();
}

function pushTime(list: (question: IRoundTimingQuestion) => number[]): void {
    const question: IRoundTimingQuestion | undefined = currentQuestion();
    if (question == undefined) {
        return;
    }

    const times: number[] = list(question);
    if (times.length < maximumTraceEntries) {
        times.push(now());
        save();
    }
}

function currentQuestion(): IRoundTimingQuestion | undefined {
    const active: IRoundTimingLog | undefined = activeLog();
    return active == undefined || currentCycle == undefined ? undefined : active.questions[currentCycle];
}

function activeLog(): IRoundTimingLog | undefined {
    if (!enabled || currentKey == undefined) {
        return undefined;
    }

    if (log == undefined) {
        log = load(currentKey) ?? { v: 1, key: currentKey, startedAt: now(), questions: {} };
    }

    return log;
}

function load(key: string): IRoundTimingLog | undefined {
    try {
        const raw: string | null = localStorage.getItem(storagePrefix + key);
        const parsed = raw == null ? undefined : (JSON.parse(raw) as IRoundTimingLog);
        return parsed?.v === 1 && parsed.questions != undefined ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function save(): void {
    if (saveTimer == undefined) {
        saveTimer = setTimeout(flush, 2000);
    }
}

function flush(): void {
    if (saveTimer != undefined) {
        clearTimeout(saveTimer);
        saveTimer = undefined;
    }

    if (log == undefined) {
        return;
    }

    try {
        localStorage.setItem(storagePrefix + log.key, JSON.stringify(log));
    } catch {
        // Full or blocked: the card works from memory until the page closes
    }
}

if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
}
