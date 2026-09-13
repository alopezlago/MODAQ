// Packets that mark power with BOLD instead of a marker.
//
// The convention nearly every set uses is a literal "(*)" in the text, and that
// is what a game format looks for. But plenty of packets — older ones
// especially, and vanity sets — mark the powered part by setting it in bold and
// putting no marker in at all. The parser preserves that faithfully: the
// question comes back as "<b>…the alfalfa farms of the </b>Lahontan Valley…",
// with nothing a format can match. Read as-is, every one of those questions is
// worth ten points and power never exists.
//
// So: where a question opens in bold and stops being bold part way through,
// that boundary IS the power mark, and a marker goes in at it.
//
// Deliberately narrow, because guessing wrong puts points on the board that
// nobody earned:
//   * the question must START bold (a bold phrase in the middle of a question
//     is emphasis, or a title, and means nothing about power);
//   * it must STOP being bold with real question left after it (a wholly bold
//     question is a formatting choice, not a power mark);
//   * there must be enough on each side of the boundary for it to be a power
//     mark at all;
//   * and a question that already carries a marker is left exactly alone.

const OPEN = /^\s*<b\s*>/i;
const MARKERS = ["(*)", "(+)"];

// A powered lead-in is a decent chunk of the question, and so is what follows.
const MIN_POWERED = 60;
const MIN_AFTER = 60;

/** The marker to write in. Standard everywhere; it is what the formats match. */
export const POWER_MARKER = "(*)";

const strip = (html: string): string => html.replace(/<[^>]*>/g, "");

/**
 * Where the leading bold ends, or -1. Word splits a bold passage into several
 * runs (a spell-check boundary is enough), so the parser can hand back a row of
 * adjacent <b> spans; they are one bold region and this walks all of them.
 */
function leadingBoldEnd(html: string): number {
    if (!OPEN.test(html)) {
        return -1;
    }
    let at = 0;
    let end = -1;
    for (;;) {
        const open = html.slice(at).match(/^\s*<b\s*>/i);
        if (open == undefined) {
            break;
        }
        at += open[0].length;
        const close = html.slice(at).search(/<\/b\s*>/i);
        if (close < 0) {
            break;
        }
        at += close;
        const closeTag = html.slice(at).match(/^<\/b\s*>/i);
        at += closeTag == undefined ? 4 : closeTag[0].length;
        end = at;
    }
    return end;
}

/**
 * A question with the power marker written in where the bold stops, or the
 * question unchanged when it says nothing about power.
 */
export function markPowerFromBold(question: string): string {
    if (typeof question !== "string" || question === "") {
        return question;
    }
    if (MARKERS.some((m) => question.includes(m))) {
        return question;
    }
    const end = leadingBoldEnd(question);
    if (end < 0) {
        return question;
    }

    const powered = strip(question.slice(0, end)).trim();
    const after = strip(question.slice(end)).trim();
    if (powered.length < MIN_POWERED || after.length < MIN_AFTER) {
        return question;
    }

    // Written outside the bold, as its own word, with exactly one space on each
    // side of it however the text was spaced.
    const head = question.slice(0, end).replace(/\s+$/, "");
    const tail = question.slice(end).replace(/^\s+/, "");
    return `${head} ${POWER_MARKER} ${tail}`;
}

/** Every tossup in a packet, with bold-marked power written in. */
export function markPacketPowerFromBold<T extends { tossups?: { question?: string }[] }>(packet: T): T {
    for (const tossup of packet?.tossups ?? []) {
        if (tossup != undefined && typeof tossup.question === "string") {
            tossup.question = markPowerFromBold(tossup.question);
        }
    }
    return packet;
}

/** How many of a packet's tossups were given a marker this way. */
export function countBoldPowered(packet: { tossups?: { question?: string }[] } | undefined): number {
    let n = 0;
    for (const tossup of packet?.tossups ?? []) {
        const q = tossup?.question;
        if (typeof q === "string" && !MARKERS.some((m) => q.includes(m)) && leadingBoldEnd(q) >= 0) {
            const end = leadingBoldEnd(q);
            if (strip(q.slice(0, end)).trim().length >= MIN_POWERED && strip(q.slice(end)).trim().length >= MIN_AFTER) {
                n++;
            }
        }
    }
    return n;
}
