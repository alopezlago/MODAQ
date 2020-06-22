import { expect } from "chai";

import * as FormattedTextParser from "src/parser/FormattedTextParser";
import { IFormattedText } from "src/parser/IFormattedText";

describe("FormattedTextParserTests", () => {
    describe("parseFormattedText", () => {
        it("No tags", () => {
            const text = "This text has no tags in it.";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(text);
            expect(result).to.deep.equal([
                {
                    text,
                    emphasized: false,
                    required: false,
                },
            ]);
        });
        it("All emphasized", () => {
            const expectedText = "This text is all emphasized.";
            const textToFormat = `<em>${expectedText}</em>`;
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat);
            expect(result).to.deep.equal([
                {
                    text: expectedText,
                    emphasized: true,
                    required: false,
                },
            ]);
        });
        it("All required", () => {
            const expectedText = "This text is all required.";
            const textToFormat = `<req>${expectedText}</req>`;
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat);
            expect(result).to.deep.equal([
                {
                    text: expectedText,
                    emphasized: false,
                    required: true,
                },
            ]);
        });
        it("Emphasized then required", () => {
            const text = "Before <em>emphasized then</em> in between <req>required then</req> done.";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(text);
            expect(result).to.deep.equal([
                {
                    text: "Before ",
                    emphasized: false,
                    required: false,
                },
                {
                    text: "emphasized then",
                    emphasized: true,
                    required: false,
                },
                {
                    text: " in between ",
                    emphasized: false,
                    required: false,
                },
                {
                    text: "required then",
                    emphasized: false,
                    required: true,
                },
                {
                    text: " done.",
                    emphasized: false,
                    required: false,
                },
            ]);
        });
        it("Overlap", () => {
            const text = "The epic <em>The <req>Iliad</req></em> is by Homer";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(text);
            expect(result).to.deep.equal([
                {
                    text: "The epic ",
                    emphasized: false,
                    required: false,
                },
                {
                    text: "The ",
                    emphasized: true,
                    required: false,
                },
                {
                    text: "Iliad",
                    emphasized: true,
                    required: true,
                },
                {
                    text: " is by Homer",
                    emphasized: false,
                    required: false,
                },
            ]);
        });
    });
    describe("splitFormattedTextIntoWords", () => {
        it("No tags", () => {
            const text = "This text has no tags in it.";
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(text);
            const expected: IFormattedText[][] = text.split(/\s+/g).map((word) => {
                return [
                    {
                        text: word,
                        emphasized: false,
                        required: false,
                    },
                ];
            });

            expect(result).to.deep.equal(expected);
        });
        it("All emphasized", () => {
            const expectedText = "This text is all emphasized.";
            const textToFormat = `<em>${expectedText}</em>`;
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(textToFormat);
            const expected: IFormattedText[][] = expectedText.split(/\s+/g).map((word) => {
                return [
                    {
                        text: word,
                        emphasized: true,
                        required: false,
                    },
                ];
            });

            expect(result).to.deep.equal(expected);
        });
        it("All required", () => {
            const expectedText = "This text is all required.";
            const textToFormat = `<req>${expectedText}</req>`;
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(textToFormat);
            const expected: IFormattedText[][] = expectedText.split(/\s+/g).map((word) => {
                return [
                    {
                        text: word,
                        emphasized: false,
                        required: true,
                    },
                ];
            });

            expect(result).to.deep.equal(expected);
        });
        it("Emphasized then required", () => {
            const text = "Before <em>emphasized then</em> in between <req>required then</req> done.";
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(text);
            expect(result).to.deep.equal([
                [
                    {
                        text: "Before",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "emphasized",
                        emphasized: true,
                        required: false,
                    },
                ],
                [
                    {
                        text: "then",
                        emphasized: true,
                        required: false,
                    },
                ],
                [
                    {
                        text: "in",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "between",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "required",
                        emphasized: false,
                        required: true,
                    },
                ],
                [
                    {
                        text: "then",
                        emphasized: false,
                        required: true,
                    },
                ],
                [
                    {
                        text: "done.",
                        emphasized: false,
                        required: false,
                    },
                ],
            ]);
        });
        it("Overlap", () => {
            const text = "The epic <em>The <req>Iliad</req></em> is by Homer";
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(text);
            expect(result).to.deep.equal([
                [
                    {
                        text: "The",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "epic",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "The",
                        emphasized: true,
                        required: false,
                    },
                ],
                [
                    {
                        text: "Iliad",
                        emphasized: true,
                        required: true,
                    },
                ],
                [
                    {
                        text: "is",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "by",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "Homer",
                        emphasized: false,
                        required: false,
                    },
                ],
            ]);
        });
        it("Punctuation after tag", () => {
            const text = "My <em>book title</em>, written by me.";
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(text);
            expect(result).to.deep.equal([
                [
                    {
                        text: "My",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "book",
                        emphasized: true,
                        required: false,
                    },
                ],
                [
                    {
                        text: "title",
                        emphasized: true,
                        required: false,
                    },
                    {
                        text: ",",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "written",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "by",
                        emphasized: false,
                        required: false,
                    },
                ],
                [
                    {
                        text: "me.",
                        emphasized: false,
                        required: false,
                    },
                ],
            ]);
        });
        it("One word with formatting", () => {
            const text = "Plain<req>required</req>dull<em>emphasized</em>boring";
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(text);
            expect(result).to.deep.equal([
                [
                    {
                        text: "Plain",
                        emphasized: false,
                        required: false,
                    },
                    {
                        text: "required",
                        emphasized: false,
                        required: true,
                    },
                    {
                        text: "dull",
                        emphasized: false,
                        required: false,
                    },
                    {
                        text: "emphasized",
                        emphasized: true,
                        required: false,
                    },
                    {
                        text: "boring",
                        emphasized: false,
                        required: false,
                    },
                ],
            ]);
        });
    });
});
