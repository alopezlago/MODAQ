// Does a packet work for a MASSINGER pick/ban, and what's off about its
// subcategories? Shown to the moderator on the game setup screen.
//
// A copy of Klaxon's server/massingerCheck.js (the director's Packets tab uses
// that one). subcatOf here IS the one the board is built from. Change one,
// change both.

export const MASSINGER_TARGET = 20;

// The subcategory from a tossup's metadata, e.g. "<Jane Smith, History - European>".
// Anything after the closing ">" (an id, an editor note) is dropped. The label
// starts at the first comma-separated part with a "Category - Subcategory"
// dash and runs to the end, so a name with commas in it ("History - Cross,
// Historiography, and Miscellaneous") stays whole and any authors before it
// are left out. Without a dash anywhere, it's the last part.
export function subcatOf(metadata: string | undefined): string {
    let text = String(metadata || "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim();
    text = text.replace(/^</, "");
    const close = text.indexOf(">");
    if (close >= 0) {
        text = text.slice(0, close);
    }
    const parts = text.split(",").map((x) => x.trim());
    const dashed = parts.findIndex((x) => /\s[-‐-―−]\s/.test(x));
    text = dashed >= 0 ? parts.slice(dashed).join(", ") : parts[parts.length - 1];
    return text.replace(/\s+/g, " ").trim() || "Uncategorized";
}

const CATEGORY_WORDS = new Set(
    `arts art events science sciences culture history literature music knowledge
  academic other mythology myth religion philosophy geography trash painting sculpture opera biology
  chemistry physics math mathematics astronomy economics psychology linguistics anthropology sociology
  film architecture poetry drama fiction sports misc miscellaneous general current social visual auditory
  classical theory technology computer earth engineering law politics government archaeology pop
  american british european world ancient modern medieval classics jazz dance theater theatre
  short long novel novels prose ballet lit sci geo cs bio chem rmpss rmp fa fine`
        .split(/\s+/)
        .filter(Boolean)
);
const looksLikePerson = (label: string): boolean =>
    /^[A-Z][a-z'’.-]+(?: [A-Z][a-z'’.-]*){1,3}$/.test(label) &&
    !label
        .toLowerCase()
        .split(/[\s/&-]+/)
        .some((w) => CATEGORY_WORDS.has(w));

const normalize = (label: string): string =>
    label
        .toLowerCase()
        .replace(/[‐-―−]/g, "-")
        .replace(/\s*([-/&])\s*/g, "$1")
        .replace(/\s+/g, " ")
        .replace(/[.:;]+$/, "")
        .trim();

export interface IMassingerCheck {
    applies: boolean;
    tossups: number;
    subcats: { label: string; count: number }[];
    issues: { kind: string; text: string }[];
}

export function checkMassingerPacket(packet: { tossups?: { metadata?: string }[] }): IMassingerCheck {
    const tossups = Array.isArray(packet?.tossups) ? packet.tossups : [];
    const counts = new Map<string, number>();
    for (const tu of tossups) {
        const label = subcatOf(tu?.metadata);
        counts.set(label, (counts.get(label) || 0) + 1);
    }
    const subcats = Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true }));
    const applies = tossups.length > MASSINGER_TARGET && subcats.length >= 2;
    const issues: { kind: string; text: string }[] = [];
    const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? "" : "s"}`;

    if (tossups.length <= MASSINGER_TARGET) {
        issues.push({
            kind: "too_few",
            text: `Only ${plural(tossups.length, "tossup")}: it needs more than ${MASSINGER_TARGET} for a pick/ban, so this round is read in full.`,
        });
    } else if (subcats.length < 2) {
        issues.push({
            kind: "no_subcats",
            text:
                subcats[0]?.label === "Uncategorized"
                    ? "No subcategories found in the metadata, so this round is read in full, with no pick/ban."
                    : `Every tossup has the same subcategory ("${subcats[0]?.label}"), so this round is read in full, with no pick/ban.`,
        });
    }
    if (applies) {
        const unc = counts.get("Uncategorized") || 0;
        if (unc) {
            issues.push({
                kind: "uncategorized",
                text: `${plural(unc, "tossup")} ${unc === 1 ? "has" : "have"} no subcategory. ${unc === 1 ? "It" : "They"} become one "Uncategorized" row on the board.`,
            });
        }
        const groups = new Map<string, string[]>();
        for (const { label } of subcats) {
            if (label === "Uncategorized") {
                continue;
            }
            const k = normalize(label);
            groups.set(k, [...(groups.get(k) || []), label]);
        }
        groups.forEach((labels) => {
            if (labels.length > 1) {
                issues.push({
                    kind: "spelling",
                    text: `Spelled more than one way: ${labels.map((l) => `"${l}"`).join(", ")}. Each spelling is its own row.`,
                });
            }
        });
        const people = subcats.filter((s) => looksLikePerson((s.label.split(",").pop() ?? "").trim())).map((s) => s.label);
        if (people.length) {
            issues.push({
                kind: "author",
                text: `${people.length === 1 ? "This looks" : "These look"} like a name, not a subcategory: ${people.slice(0, 3).map((l) => `"${l}"`).join(", ")}${people.length > 3 ? ` and ${people.length - 3} more` : ""}. Put the subcategory after the author, as "Category - Subcategory".`,
            });
        }
    }
    return { applies, tossups: tossups.length, subcats, issues };
}
