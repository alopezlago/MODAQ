import { expect } from "chai";

import * as FormattedTextParser from "src/parser/FormattedTextParser";
import * as GameFormats from "src/state/GameFormats";
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
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
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
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
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
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
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
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
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
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("All subscripted", () => {
            const expectedText = "This text is all subscripted.";
            const textToFormat = `<sub>${expectedText}</sub>`;
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat);
            expect(result).to.deep.equal([
                {
                    text: expectedText,
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: true,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("All superscripted", () => {
            const expectedText = "This text is all superscripted.";
            const textToFormat = `<sup>${expectedText}</sup>`;
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat);
            expect(result).to.deep.equal([
                {
                    text: expectedText,
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: true,
                    pronunciation: false,
                },
            ]);
        });
        it("Pronunciation guide", () => {
            const textToFormat = "This text is mine (mein).";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: GameFormats.ACFGameFormat.pronunciationGuideMarkers,
            });
            expect(result).to.deep.equal([
                {
                    text: "This text is mine ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "(mein)",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: ".",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Bolded pronunciation guide", () => {
            const textToFormat = "<b>Solano Lopez (LOW-pez)</b> was in this war.";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: GameFormats.ACFGameFormat.pronunciationGuideMarkers,
            });
            expect(result).to.deep.equal([
                {
                    text: "Solano Lopez ",
                    bolded: true,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "(LOW-pez)",
                    bolded: true,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: " was in this war.",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Non-parentheses pronunciation guide", () => {
            const textToFormat = "This text is mine [mein].";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ["[", "]"],
            });
            expect(result).to.deep.equal([
                {
                    text: "This text is mine ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "[mein]",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: ".",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Different pronunciation guide", () => {
            const textToFormat = "This text is mine (mein).";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ["[", "]"],
            });
            expect(result).to.deep.equal([
                {
                    text: "This text is mine (mein).",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Special quotes in text with normal quotes in pronunciation guide", () => {
            const textToFormat = "This text is mine (“mein”).";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ['("', '")'],
            });
            expect(result).to.deep.equal([
                {
                    text: "This text is mine ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "(“mein”)",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: ".",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Normal quotes in text with special quotes in pronunciation guide", () => {
            const textToFormat = 'This text is mine ("mein").';
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ["(“", "”)"],
            });
            expect(result).to.deep.equal([
                {
                    text: "This text is mine ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: '("mein")',
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: ".",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Mixed quotes in text (special, normal) in pronunciation guide", () => {
            const textToFormat = 'This text is mine (“mein").';
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ["(“", "”)"],
            });
            expect(result).to.deep.equal([
                {
                    text: "This text is mine ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: '(“mein")',
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: ".",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Mixed quotes in text (normal, special) in pronunciation guide", () => {
            const textToFormat = 'This text is mine ("mein”).';
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ["(“", "”)"],
            });
            expect(result).to.deep.equal([
                {
                    text: "This text is mine ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: '("mein”)',
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: ".",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Special quotes in wrong order in pronunciation guide", () => {
            const textToFormat = "This text is mine (”mein“).";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ['("', '")'],
            });
            expect(result).to.deep.equal([
                {
                    text: "This text is mine (”mein“).",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Case insensitive normal quotes in text with special quotes in pronunciation guide", () => {
            const textToFormat = 'This text is mine (a"mein"a).';
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ["(A“", "”A)"],
            });
            expect(result).to.deep.equal([
                {
                    text: "This text is mine ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: '(a"mein"a)',
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: ".",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Default reader directives", () => {
            const textToFormat =
                "This (Emphasize) equation is proportional to (read slowly) a minus x, plus (pause) 1.";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ["[", "]"],
                // readerDirectives: ["(emphasize)", "(read slowly)", "(pause)"],
            });
            expect(result).to.deep.equal([
                {
                    text: "This ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "(Emphasize)",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: " equation is proportional to ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "(read slowly)",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: " a minus x, plus ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "(pause)",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: " 1.",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
            ]);
        });
        it("Explicit reader directives", () => {
            const textToFormat = "This (Emphasize) equation is proportional to (slowly) a minus x, plus (pause) 1.";
            const result: IFormattedText[] = FormattedTextParser.parseFormattedText(textToFormat, {
                pronunciationGuideMarkers: ["[", "]"],
                readerDirectives: ["(slowly)"],
            });
            expect(result).to.deep.equal([
                {
                    text: "This (Emphasize) equation is proportional to ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "(slowly)",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: true,
                },
                {
                    text: " a minus x, plus (pause) 1.",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
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
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "emphasized then",
                    bolded: false,
                    emphasized: true,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: " in between ",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "required then",
                    bolded: true,
                    emphasized: false,
                    underlined: true,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: " done.",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
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
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "The ",
                    bolded: false,
                    emphasized: true,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: "Iliad",
                    bolded: true,
                    emphasized: true,
                    underlined: true,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
                },
                {
                    text: " is by Homer",
                    bolded: false,
                    emphasized: false,
                    underlined: false,
                    subscripted: false,
                    superscripted: false,
                    pronunciation: false,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ];
            });

            expect(result).to.deep.equal(expected);
        });
        it("All subscripted", () => {
            const expectedText = "This text is all subscripted.";
            const textToFormat = `<sub>${expectedText}</sub>`;
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(textToFormat);
            const expected: IFormattedText[][] = expectedText.split(/\s+/g).map((word) => {
                return [
                    {
                        text: word,
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: true,
                        superscripted: false,
                        pronunciation: false,
                    },
                ];
            });

            expect(result).to.deep.equal(expected);
        });
        it("All superscripted", () => {
            const expectedText = "This text is all superscripted.";
            const textToFormat = `<sup>${expectedText}</sup>`;
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(textToFormat);
            const expected: IFormattedText[][] = expectedText.split(/\s+/g).map((word) => {
                return [
                    {
                        text: word,
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: true,
                        pronunciation: false,
                    },
                ];
            });

            expect(result).to.deep.equal(expected);
        });
        it("Pronunciation", () => {
            const textToFormat = "There is a pronunciation guide (GUY-de) in this question.";
            const result: IFormattedText[][] = FormattedTextParser.splitFormattedTextIntoWords(textToFormat, {
                pronunciationGuideMarkers: GameFormats.ACFGameFormat.pronunciationGuideMarkers,
            });
            const expected: IFormattedText[][] = textToFormat.split(/\s+/g).map((word, index) => {
                return [
                    {
                        text: word,
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: index === 5,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "emphasized",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "then",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "in",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "between",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "required",
                        bolded: true,
                        emphasized: false,
                        underlined: true,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "then",
                        bolded: true,
                        emphasized: false,
                        underlined: true,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "done.",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "epic",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "The",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "Iliad",
                        bolded: true,
                        emphasized: true,
                        underlined: true,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "is",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "by",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "Homer",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "epic",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "The",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "Iliad",
                        bolded: true,
                        emphasized: true,
                        underlined: true,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "is",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "by",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "Homer",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "book",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "title",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                    {
                        text: ",",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "written",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "by",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
                [
                    {
                        text: "me.",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
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
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                    {
                        text: "required",
                        bolded: true,
                        emphasized: false,
                        underlined: true,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                    {
                        text: "dull",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                    {
                        text: "emphasized",
                        bolded: false,
                        emphasized: true,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                    {
                        text: "bolded",
                        bolded: true,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                    {
                        text: "boring",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                    {
                        text: "underlined",
                        bolded: false,
                        emphasized: false,
                        underlined: true,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                    {
                        text: "word",
                        bolded: false,
                        emphasized: false,
                        underlined: false,
                        subscripted: false,
                        superscripted: false,
                        pronunciation: false,
                    },
                ],
            ]);
        });
    });
});
