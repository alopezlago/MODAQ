// Turn a PDF packet into the HTML that YAPP parses.
//
// YAPP only reads Word documents and HTML (anything that isn't a zip goes
// through its HtmlLexer: one <p> per line, with <b>/<i>/<u>/<sub>/<sup> for
// formatting). A PDF has neither: it is glyphs placed on a page. So this
// rebuilds what the Word document had — its paragraphs and the formatting
// inside them — and lets YAPP do the actual parsing, exactly as it would for
// the .docx the PDF was printed from.
//
// Three things make that harder than reading the text off the page:
//
//   * A PDF has LINES, not paragraphs. A tossup wraps over five or six of
//     them, and YAPP joins the lines of a question with no space between
//     them, so they have to be put back together here. A line starts a new
//     paragraph only when it starts with something YAPP would read as the
//     start of a new part (a question number, "ANSWER:", a bonus part's "[10]",
//     an "<author, category>" line), when there's a gap above it, or when its
//     type size changes (a heading).
//   * A wrapped line can look like a new question: "...in the year" /
//     "1914. This ruler...". A question number only counts when the previous
//     question has had its answer — until then it's more of the same question.
//   * Every page repeats a header and a footer ("Packet 5 — Page 3"), which
//     would otherwise land in the middle of whichever question crosses the
//     page break.
//
// Bold and italic come from the fonts ("Calibri-Bold"). Underline isn't a font
// property in a PDF — Word draws it as a thin filled rectangle under the text —
// so it's found by looking for those rectangles just below the baseline.
//
// This file takes pdf.js as a parameter rather than importing it, so the
// moderator page can load the (large) library only when someone actually drops
// a PDF, and so the same code runs under Node in tests.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface IPdfJsLib {
    getDocument(src: any): { promise: Promise<any> };
    OPS: Record<string, number>;
}

interface IRun {
    text: string;
    x: number;
    y: number; // baseline
    width: number;
    size: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    sup: boolean;
    sub: boolean;
}

interface ILine {
    page: number;
    y: number;
    size: number;
    left: number;
    right: number;
    runs: IRun[];
    text: string;
}

interface IRule {
    x0: number;
    x1: number;
    y: number; // vertical centre
}

const BOLD_NAME = /bold|black|heavy|semibold|demi|extrab|ultrab/i;
const ITALIC_NAME = /italic|oblique|slanted/i;

// The same patterns YAPP's LexerClassifier uses, so a line is only treated as
// the start of something when YAPP would agree.
const QUESTION_START = /^\s*(\d+|tb|tie(breaker)?)\s*\.\s*/i;
const ANSWER_START = /^\s*ANS(WER)?\s*(:|\.)\s*/i;
const BONUS_PART_START = /^\s*\[(\s*(\d+\s*[ehm]?\s*|[ehm]\s*))\]\s*/i;
const METADATA_START = /^\s*<[^<>]+>\s*/;
const HEADING = /^\s*(tossups?|bonus(es)?|tie-?breakers?|extra( questions| tossups| bonuses)?|replacements?|spares?)\s*:?\s*$/i;
// "TIEBREAKER/EXTRA TOSSUPS", "BONUSES (EXTRA)": a short capitalised line
// naming a section. Needs one of the words, so a wrapped answer line in capitals
// ("ORGANIZATION]") is never mistaken for one.
const CAPS_HEADING = /^[^a-z]{0,60}$/;
const HEADING_WORD = /TOSS-?UPS?|BONUS|TIE-?BREAK|EXTRA|SPARE|REPLACEMENT|OVERTIME/;
// "ANSWER Tosca" — the colon forgotten. YAPP only knows an answer line by it,
// so a packet with one such slip fails to parse at all; in capitals at the
// start of a line nothing else in a packet looks like that, so the colon is
// put back.
const ANSWER_NO_COLON = /^(\s*ANSWER)\s+(?=\S)/;
const PAGE_NUMBER = /^\s*(page\s*)?\d+(\s*(of|\/)\s*\d+)?\s*$/i;

/**
 * Read a PDF packet and return the HTML YAPP wants. Throws with a readable
 * message when the PDF has no text layer (a scan), which nothing downstream
 * could do anything with.
 */
export async function pdfToPacketHtml(pdfjs: IPdfJsLib, data: Uint8Array): Promise<string> {
    const doc = await pdfjs.getDocument({
        data,
        // Nothing is drawn, so there's no reason to hand fonts to the browser
        // or to run the PDF's own scripts.
        disableFontFace: true,
        isEvalSupported: false,
        // Keeps each font's real name ("ABCDEF+Calibri-Bold") on the font
        // object, which is the only place bold and italic are written down.
        fontExtraProperties: true,
        useSystemFonts: false,
    }).promise;
    try {
        const lines: ILine[] = [];
        const pageHeights: number[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const viewport = page.getViewport({ scale: 1 });
            pageHeights.push(viewport.height);
            // The operator list loads the page's fonts into commonObjs (so the
            // names below resolve) and carries the underline rectangles.
            const ops = await page.getOperatorList();
            const rules = underlineRules(pdfjs, ops);
            const content = await page.getTextContent();
            const runs = toRuns(page, content.items, rules);
            lines.push(...toLines(runs, p));
            page.cleanup();
        }
        if (lines.every((l) => l.text.trim() === "")) {
            throw new Error(
                "That PDF has no text in it — it's probably a scan. Try the Word version of the packet instead."
            );
        }
        const kept = dropRepeatedMargins(lines, pageHeights);
        return toHtml(toParagraphs(kept));
    } finally {
        doc.destroy();
    }
}

// --- runs --------------------------------------------------------------------

function fontStyle(page: any, fontName: string): { bold: boolean; italic: boolean } {
    let name = fontName;
    let bold = false;
    let italic = false;
    try {
        if (page.commonObjs.has(fontName)) {
            const font = page.commonObjs.get(fontName);
            name = String(font?.name ?? font?.loadedName ?? fontName);
            bold = font?.bold === true || font?.black === true;
            italic = font?.italic === true;
        }
    } catch {
        /* a font we can't look up is just regular text */
    }
    return { bold: bold || BOLD_NAME.test(name), italic: italic || ITALIC_NAME.test(name) };
}

function toRuns(page: any, items: any[], rules: IRule[]): IRun[] {
    const runs: IRun[] = [];
    for (const item of items) {
        if (typeof item?.str !== "string" || item.str === "") {
            continue;
        }
        const [a, b, c, d, e, f] = item.transform as number[];
        // Rotated text is a watermark or a margin note, never a question.
        if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01 || a <= 0 || d <= 0) {
            continue;
        }
        const size = Math.abs(d) || Math.abs(a) || 10;
        const style = fontStyle(page, item.fontName);
        const run: IRun = {
            text: item.str,
            x: e,
            y: f,
            width: Number(item.width) || 0,
            size,
            bold: style.bold,
            italic: style.italic,
            underline: false,
            sup: false,
            sub: false,
        };
        runs.push(...applyUnderline(run, rules));
    }
    return runs;
}

// --- underline ---------------------------------------------------------------
// Word draws an underline as a filled rectangle a point or so tall, just under
// the baseline. pdf.js hands the page's drawing operations over as a list; the
// rectangles are the constructPath entries whose bounding box is short and
// wide. Everything here is best-effort: if pdf.js changes how it reports
// paths, underline quietly stops being detected and nothing else is affected.

function multiply(m: number[], n: number[]): number[] {
    return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
    ];
}

function apply(m: number[], x: number, y: number): [number, number] {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function underlineRules(pdfjs: IPdfJsLib, ops: any): IRule[] {
    const rules: IRule[] = [];
    try {
        const OPS = pdfjs.OPS;
        const fnArray: number[] = ops.fnArray;
        const argsArray: any[] = ops.argsArray;
        let ctm = [1, 0, 0, 1, 0, 0];
        const stack: number[][] = [];
        for (let i = 0; i < fnArray.length; i++) {
            const fn = fnArray[i];
            const args = argsArray[i];
            if (fn === OPS.save) {
                stack.push(ctm);
            } else if (fn === OPS.restore) {
                ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
            } else if (fn === OPS.transform) {
                ctm = multiply(ctm, args as number[]);
            } else if (fn === OPS.constructPath) {
                // The last argument is the path's bounding box in the current
                // user space: [minX, minY, maxX, maxY].
                const box = args?.[args.length - 1];
                if (!box || box.length !== 4) {
                    continue;
                }
                const [x0, y0] = apply(ctm, box[0], box[1]);
                const [x1, y1] = apply(ctm, box[2], box[3]);
                const w = Math.abs(x1 - x0);
                const h = Math.abs(y1 - y0);
                if (w > 2 && h < 2.5 && w > h * 4) {
                    rules.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y: (y0 + y1) / 2 });
                }
            }
        }
    } catch {
        return [];
    }
    return rules;
}

// Rough advance widths (in ems) for a proportional serif/sans face. pdf.js
// reports a run's total width but not where each character sits in it, so the
// characters under a rule are estimated from these. They only have to be good
// enough to land within a word: see snapToWords.
function charWidth(ch: string): number {
    if (ch === " ") return 0.25;
    if ("iljtf.,;:'!|()[]“”‘’\"".includes(ch)) return 0.3;
    if ("rsI-".includes(ch)) return 0.4;
    if ("mwMW".includes(ch)) return 0.85;
    if (ch >= "A" && ch <= "Z") return 0.68;
    return 0.52;
}

// Mark the part of a run that has a rule under it. A run is one font, but an
// underline can stop partway through it (a prompt: "prompt on <u>Italy</u> or
// northern Italy"), so the run is split where the rule starts and ends.
function applyUnderline(run: IRun, rules: IRule[]): IRun[] {
    if (rules.length === 0 || run.width <= 0 || run.text.trim() === "") {
        return [run];
    }
    const below = rules.filter(
        (r) =>
            r.y < run.y + run.size * 0.05 &&
            r.y > run.y - run.size * 0.45 &&
            r.x1 > run.x + 0.5 &&
            r.x0 < run.x + run.width - 0.5
    );
    if (below.length === 0) {
        return [run];
    }
    const chars = Array.from(run.text);
    const widths = chars.map(charWidth);
    const scale = run.width / widths.reduce((sum, w) => sum + w, 0);
    const marked: boolean[] = [];
    let at = run.x;
    for (const w of widths) {
        const mid = at + (w * scale) / 2;
        marked.push(below.some((r) => mid >= r.x0 && mid <= r.x1));
        at += w * scale;
    }
    snapToWords(chars, marked);

    const pieces: IRun[] = [];
    let start = 0;
    let x = run.x;
    for (let i = 1; i <= chars.length; i++) {
        if (i === chars.length || marked[i] !== marked[start]) {
            const width = widths.slice(start, i).reduce((sum, w) => sum + w, 0) * scale;
            pieces.push({ ...run, text: chars.slice(start, i).join(""), x, width, underline: marked[start] });
            x += width;
            start = i;
        }
    }
    return pieces;
}

// Underlining in a packet covers whole words (or, where it covers part of one,
// the part is in a different font — "<b><u>alp</u></b>horns" — and so is a run
// of its own and never estimated). So a word that is mostly under the rule is
// underlined, one that is only clipped by it isn't, and a space is underlined
// only between two underlined words. That turns an estimate that drifts by a
// letter or two ("<u>Piedmont u</u>ntil") into the right answer.
function snapToWords(chars: string[], marked: boolean[]): void {
    const words: [number, number][] = [];
    let i = 0;
    while (i < chars.length) {
        if (/\s/.test(chars[i])) {
            i++;
            continue;
        }
        const start = i;
        while (i < chars.length && !/\s/.test(chars[i])) i++;
        words.push([start, i]);
    }
    for (const [start, end] of words) {
        const count = marked.slice(start, end).filter(Boolean).length;
        const on = count * 2 > end - start;
        for (let k = start; k < end; k++) marked[k] = on;
    }
    for (let k = 0; k < chars.length; k++) {
        if (/\s/.test(chars[k])) {
            let before = k - 1;
            while (before >= 0 && /\s/.test(chars[before])) before--;
            let after = k + 1;
            while (after < chars.length && /\s/.test(chars[after])) after++;
            marked[k] = before >= 0 && after < chars.length && marked[before] && marked[after];
        }
    }
}

// --- lines -------------------------------------------------------------------

function toLines(runs: IRun[], page: number): ILine[] {
    const lines: ILine[] = [];
    let current: ILine | undefined;
    for (const run of runs) {
        if (current && sameLine(current, run)) {
            addToLine(current, run);
            continue;
        }
        current = { page, y: run.y, size: run.size, left: run.x, right: run.x + run.width, runs: [], text: "" };
        addToLine(current, run);
        lines.push(current);
    }
    for (const line of lines) {
        line.runs.sort((r1, r2) => r1.x - r2.x);
        markScripts(line);
        line.text = line.runs.map((r) => r.text).join("");
    }
    return lines.filter((l) => l.text.trim() !== "");
}

// A run belongs to the line being built when it sits on (or, for a superscript
// or subscript, just off) that line's baseline and doesn't jump back to the
// left margin — pdf.js reports text in the order it was drawn, which for a
// packet is reading order.
function sameLine(line: ILine, run: IRun): boolean {
    const dy = run.y - line.y;
    const size = Math.max(line.size, run.size);
    if (Math.abs(dy) < size * 0.2) {
        return run.x > line.left - size * 0.5;
    }
    // Raised or lowered, smaller, and carrying on to the right: a superscript
    // ("10<sup>th</sup>") or subscript ("H<sub>2</sub>O").
    const smaller = run.size < line.size * 0.9 || line.size < run.size * 0.9;
    return smaller && Math.abs(dy) < size * 0.6 && run.x >= line.right - size * 0.6;
}

function addToLine(line: ILine, run: IRun): void {
    // pdf.js usually reports the spaces between words, but not always; put one
    // back when there's a visible gap and neither side already has it.
    const last = line.runs[line.runs.length - 1];
    if (last && run.x - line.right > Math.min(run.size, line.size) * 0.18) {
        if (!/\s$/.test(last.text) && !/^\s/.test(run.text)) {
            line.runs.push({ ...run, text: " ", width: 0, underline: false, sup: false, sub: false });
        }
    }
    line.runs.push(run);
    // The line's baseline and size are its main text's, not a superscript's.
    if (run.size > line.size) {
        line.size = run.size;
        line.y = run.y;
    }
    line.left = Math.min(line.left, run.x);
    line.right = Math.max(line.right, run.x + run.width);
}

function markScripts(line: ILine): void {
    for (const run of line.runs) {
        if (run.size < line.size * 0.9 && run.text.trim() !== "") {
            if (run.y > line.y + line.size * 0.15) {
                run.sup = true;
            } else if (run.y < line.y - line.size * 0.08) {
                run.sub = true;
            }
        }
    }
}

// --- page furniture ------------------------------------------------------------
// A line in the top or bottom margin that turns up on most pages (numbers
// ignored, so "Page 3" matches "Page 4") is a running header or footer.

function dropRepeatedMargins(lines: ILine[], pageHeights: number[]): ILine[] {
    const pages = pageHeights.length;
    const key = (l: ILine): string => l.text.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
    const inMargin = (l: ILine): boolean => {
        const h = pageHeights[l.page - 1] || 792;
        return l.y > h * 0.9 || l.y < h * 0.08;
    };
    const seenOn = new Map<string, Set<number>>();
    for (const l of lines) {
        if (!inMargin(l)) continue;
        const k = key(l);
        const pagesSeen = seenOn.get(k) ?? new Set<number>();
        pagesSeen.add(l.page);
        seenOn.set(k, pagesSeen);
    }
    return lines.filter((l) => {
        if (!inMargin(l)) return true;
        if (PAGE_NUMBER.test(l.text)) return false;
        const count = seenOn.get(key(l))?.size ?? 0;
        return !(pages >= 2 && count >= Math.max(2, Math.ceil(pages * 0.5)));
    });
}

// --- paragraphs ------------------------------------------------------------------

type Kind = "question" | "answer" | "part" | "metadata" | "heading" | "text";

function kindOf(text: string): Kind {
    if (ANSWER_START.test(text) || ANSWER_NO_COLON.test(text)) return "answer";
    if (BONUS_PART_START.test(text)) return "part";
    if (METADATA_START.test(text)) return "metadata";
    if (HEADING.test(text) || (CAPS_HEADING.test(text) && HEADING_WORD.test(text))) return "heading";
    if (QUESTION_START.test(text)) return "question";
    return "text";
}

function restoreAnswerColon(line: ILine): void {
    if (ANSWER_START.test(line.text)) return;
    // The word is often a run of its own, with the space after it the next one.
    const first = line.runs.find((r) => r.text.trim() !== "");
    if (first && /^\s*ANSWER\b/.test(first.text)) {
        first.text = first.text.replace(/^(\s*ANSWER)\s*/, "$1: ");
        line.text = line.runs.map((r) => r.text).join("");
    }
}

function toParagraphs(lines: ILine[]): IRun[][] {
    const paragraphs: IRun[][] = [];
    // The usual distance from one line to the next, to tell a wrapped line from
    // one that starts after a gap.
    const gaps: number[] = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].page === lines[i - 1].page) {
            const g = lines[i - 1].y - lines[i].y;
            if (g > 0) gaps.push(g);
        }
    }
    gaps.sort((g1, g2) => g1 - g2);
    const lineStep = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 14;

    // Whether the question (or bonus part) being built has had its answer yet.
    // Until it has, a line that happens to start "1914." is still that question.
    let awaitingAnswer = false;
    let current: IRun[] | undefined;
    let previous: ILine | undefined;
    let previousKind: Kind = "text";

    for (const line of lines) {
        let kind = kindOf(line.text);
        if (kind === "question" && awaitingAnswer) {
            kind = "text";
        }
        if (kind === "answer") {
            restoreAnswerColon(line);
        }
        const gap = previous && previous.page === line.page ? previous.y - line.y : 0;
        const breaks =
            current == undefined ||
            kind !== "text" ||
            previousKind === "heading" ||
            gap > lineStep * 1.45 ||
            (previous != undefined && Math.abs(line.size - previous.size) > Math.max(line.size, previous.size) * 0.18);

        if (!breaks && current != undefined) {
            joinLine(current, line);
            previous = line;
            continue;
        }
        current = line.runs.map((r) => ({ ...r }));
        paragraphs.push(current);
        previous = line;
        previousKind = kind;

        // A bonus part waits for its answer just as a tossup does ("[10] ...
        // killed some 500 laborers in" / "1895. Young men of...").
        if (kind === "question" || kind === "part") {
            awaitingAnswer = true;
        } else if (kind === "answer") {
            awaitingAnswer = false;
        }
    }
    return paragraphs;
}

// A wrapped line carries on the paragraph after a space — except a word broken
// with a hyphen at the end of the line, which carries on directly.
function joinLine(paragraph: IRun[], line: ILine): void {
    const last = paragraph[paragraph.length - 1];
    const runs = line.runs.map((r) => ({ ...r }));
    if (last && /[A-Za-z]-$/.test(last.text) && /^[a-z]/.test(runs[0]?.text ?? "")) {
        last.text = last.text.slice(0, -1);
    } else if (last && !/\s$/.test(last.text)) {
        paragraph.push({ ...runs[0], text: " ", underline: false, sup: false, sub: false });
    }
    paragraph.push(...runs);
}

// --- html ------------------------------------------------------------------------

const escapeHtml = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function toHtml(paragraphs: IRun[][]): string {
    const out: string[] = [];
    for (const runs of paragraphs) {
        let html = "";
        for (const run of mergeRuns(runs)) {
            // A space's formatting doesn't matter to anyone reading, and
            // leaving it plain keeps "<b>George</b> <b>Washington</b>" from
            // becoming one bolded phrase with an underlined gap in it.
            let piece = escapeHtml(run.text.replace(/\s+/g, " "));
            if (run.text.trim() === "") {
                html += piece;
                continue;
            }
            if (run.sup) piece = `<sup>${piece}</sup>`;
            if (run.sub) piece = `<sub>${piece}</sub>`;
            if (run.underline) piece = `<u>${piece}</u>`;
            if (run.italic) piece = `<i>${piece}</i>`;
            if (run.bold) piece = `<b>${piece}</b>`;
            html += piece;
        }
        html = html.replace(/\s+/g, " ").trim();
        if (html !== "") {
            out.push(`<p>${html}</p>`);
        }
    }
    return `<html><body>\n${out.join("\n")}\n</body></html>`;
}

function mergeRuns(runs: IRun[]): IRun[] {
    const merged: IRun[] = [];
    const same = (r1: IRun, r2: IRun): boolean =>
        r1.bold === r2.bold &&
        r1.italic === r2.italic &&
        r1.underline === r2.underline &&
        r1.sup === r2.sup &&
        r1.sub === r2.sub;
    for (const run of runs) {
        const last = merged[merged.length - 1];
        if (last && last.text.trim() !== "" && run.text.trim() !== "" && same(last, run)) {
            last.text += run.text;
        } else {
            merged.push({ ...run });
        }
    }
    return merged;
}
