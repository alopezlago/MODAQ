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
                    bolded: false,
                    emphasized: false,
                    underlined: false,
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
                    bolded: false,
                    emphasized: true,
                    underlined: false,
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
                    bolded: true,
                    emphasized: false,
                    underlined: true,
                },
            ]);
        });
        it("All bolded", () => {
            const expectedText = "This text is all bolded.";
            const textToFormat = `<b>${expectedText}</b>`;
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat);
            expect(result).to.deep.equal([
                {
                    text: expectedText,
                    bolded: true,
                    emphasized: false,
                    underlined: false,
                },
            ]);
        });
        it("All underlined", () => {
            const expectedText = "This text is all underlined.";
            const textToFormat = `<u>${expectedText}</u>`;
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat);
            expect(result).to.deep.equal([
                {
                    text: expectedText,
                    bolded: false,
                    emphasized: false,
                    underlined: true,
                },
            ]);
        });
        it("Emphasized then required", () => {
            const text = "Before <em>emphasized then</em> in between <req>required then</req> done.";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(text);
            expect(result).to.deep.equal([
                {
                    text: "Before ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                },
                {
                    text: "emphasized then",
                    bolded: false,
                    emphasized: true,
                    underlined: false,
                },
                {
                    text: " in between ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                },
                {
                    text: "required then",
                    bolded: true,
                    emphasized: false,
                    underlined: true,
                },
                {
                    text: " done.",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                },
            ]);
        });
        it("Overlap", () => {
            const text = "The epic <em>The <req>Iliad</req></em> is by Homer";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(text);
            expect(result).to.deep.equal([
                {
                    text: "The epic ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                },
                {
                    text: "The ",
                    bolded: false,
                    emphasized: true,
                    underlined: false,
                },
                {
                    text: "Iliad",
                    bolded: true,
                    emphasized: true,
                    underlined: true,
                },
                {
                    text: " is by Homer",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
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
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ];
            });

            expect(result).to.deep.equal(expected);
        });
        it("All bolded", () => {
            const expectedText = "This text is all bolded.";
            const textToFormat = `<b>${expectedText}</b>`;
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(textToFormat);
            const expected: IFormattedText[][] = expectedText.split(/\s+/g).map((word) => {
                return [
                    {
                        text: word,
                        bolded: true,
                        emphasized: false,
                        underlined: false,
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
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                    },
                ];
            });

            expect(result).to.deep.equal(expected);
        });
        it("All underlined", () => {
            const expectedText = "This text is all bolded.";
            const textToFormat = `<u>${expectedText}</u>`;
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(textToFormat);
            const expected: IFormattedText[][] = expectedText.split(/\s+/g).map((word) => {
                return [
                    {
                        text: word,
                        bolded: false,
                        emphasized: false,
                        underlined: true,
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
                        bolded: true,
                        emphasized: false,
                        underlined: true,
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
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "emphasized",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "then",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "in",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "between",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "required",
                        bolded: true,
                        emphasized: false,
                        underlined: true,
                    },
                ],
                [
                    {
                        text: "then",
                        bolded: true,
                        emphasized: false,
                        underlined: true,
                    },
                ],
                [
                    {
                        text: "done.",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
            ]);
        });
        it("Overlap (req)", () => {
            const text = "The epic <em>The <req>Iliad</req></em> is by Homer";
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(text);
            expect(result).to.deep.equal([
                [
                    {
                        text: "The",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "epic",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "The",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "Iliad",
                        bolded: true,
                        emphasized: true,
                        underlined: true,
                    },
                ],
                [
                    {
                        text: "is",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "by",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "Homer",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
            ]);
        });
        it("Overlap (bold + underline)", () => {
            const text = "The epic <em>The <u><b>Iliad</b></u></em> is by Homer";
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(text);
            expect(result).to.deep.equal([
                [
                    {
                        text: "The",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "epic",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "The",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "Iliad",
                        bolded: true,
                        emphasized: true,
                        underlined: true,
                    },
                ],
                [
                    {
                        text: "is",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "by",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "Homer",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
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
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "book",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "title",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                    },
                    {
                        text: ",",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "written",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "by",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
                [
                    {
                        text: "me.",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
            ]);
        });
        it("One word with formatting", () => {
            const text = "Plain<req>required</req>dull<em>emphasized</em><b>bolded</b>boring<u>underlined</u>word";
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(text);
            expect(result).to.deep.equal([
                [
                    {
                        text: "Plain",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                    {
                        text: "required",
                        bolded: true,
                        emphasized: false,
                        underlined: true,
                    },
                    {
                        text: "dull",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                    {
                        text: "emphasized",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                    },
                    {
                        text: "bolded",
                        bolded: true,
                        emphasized: false,
                        underlined: false,
                    },
                    {
                        text: "boring",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                    {
                        text: "underlined",
                        bolded: false,
                        emphasized: false,
                        underlined: true,
                    },
                    {
                        text: "word",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                    },
                ],
            ]);
        });
    });
});
