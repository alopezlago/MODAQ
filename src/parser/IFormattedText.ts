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
     * Obsolete. Use bolded and underlined instead.
     */
    required?: boolean;
    underlined?: boolean;
    subscripted?: boolean;
    superscripted?: boolean;
}
