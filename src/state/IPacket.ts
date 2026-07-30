/**
 * Prefix of the `IPacket.version` values that mean "YAPP2". Compared case-insensitively; a reader that understands
 * 1.0 can accept later 1.x versions, since minor bumps only add optional fields.
 */
export const yapp2VersionPrefix = "yapp2/";

/** The YAPP2 version this code writes. */
export const yapp2Version = "yapp2/1.0";

export interface IPacket {
    tossups: ITossup[];
    bonuses?: IBonus[];
    name?: string;

    /**
     * Format marker. Absent for plain YAPP packets; `"yapp2/<major>.<minor>"` for YAPP2, which adds pronunciation
     * guide anchoring via the `anchored` fields below. See YAPP2_FORMAT.md.
     */
    version?: string;
}

export interface ITossup {
    question: string;
    answer: string;
    metadata?: string;

    /**
     * YAPP2 only: the same fields, with `<pg>...</pg>` marking the word(s) each pronunciation guide covers. The
     * canonical fields stay free of the tag so plain-YAPP readers are unaffected, so a YAPP2-aware reader should
     * prefer these when present.
     */
    anchored?: IAnchoredTossupText;
}

export interface IBonus {
    leadin: string;
    parts: string[];
    answers: string[];
    values: number[];
    difficultyModifiers?: string[];
    metadata?: string;

    /** YAPP2 only. See `ITossup.anchored`. */
    anchored?: IAnchoredBonusText;
}

export interface IAnchoredTossupText {
    question?: string;
    answer?: string;
}

export interface IAnchoredBonusText {
    leadin?: string;

    /** Must be the same length as `IBonus.parts`; entries are matched up by index. */
    parts?: string[];

    /** Must be the same length as `IBonus.answers`; entries are matched up by index. */
    answers?: string[];
}
