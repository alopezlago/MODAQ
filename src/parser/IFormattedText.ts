export interface IFormattedText {
    /**
     * The text of this fragment
     */
    text: string;
    bolded: boolean;

    /**
     * If text is emphasized, which is italicized.
     */
    emphasized: boolean;

    /**
     * `true` if this text should be formatted like a pronunciation guide or reader directive.
     */
    pronunciation?: boolean;

    /**
     * `true` if this text is the word(s) that a nearby pronunciation guide covers, i.e. the guide's anchor.
     * Set by the YAPP2 `<pg>` tag.
     *
     * Unlike `pronunciation`, this text is part of the question: it is read aloud, counts as words, and can be
     * buzzed on. It only says which words the guide applies to, so it is safe to ignore when formatting.
     */
    pronunciationTarget?: boolean;

    /**
     * Obsolete. Use bolded and underlined instead.
     */
    required?: boolean;
    underlined?: boolean;
    subscripted?: boolean;
    superscripted?: boolean;
}
