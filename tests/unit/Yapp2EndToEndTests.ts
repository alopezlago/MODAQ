import { expect } from "chai";

import * as FormattedTextParser from "src/parser/FormattedTextParser";
import * as GameFormats from "src/state/GameFormats";
import * as PacketLoaderController from "src/components/PacketLoaderController";
import { AppState } from "src/state/AppState";
import { IFormattedText } from "src/parser/IFormattedText";
import { IPacket } from "src/state/IPacket";
import { ITossupWord, PacketState } from "src/state/PacketState";

// Real output from QEMS's exporter (qems2/qsub/yapp_export.py) for the same two tossups and one bonus: once as plain
// YAPP, once as YAPP2. Embedded verbatim as text rather than read from disk because this tsconfig deliberately
// excludes @types/node, so tests can't use `fs`. To regenerate, export a set from QEMS with a \P-anchored question
// via "Export Packetized YAPP JSON" and "Export Packetized YAPP2 JSON" and paste the two files here.
const qemsYapp1 = `{
  "tossups": [
    {
      "number": 1,
      "question": "Denis Diderot (\\"DID-er-OW\\") edited a famous encyclopedia with this man, who (*) also wrote on mathematics. For 10 points, name this French mathematician.",
      "answer": "<b><u>Jean le Rond d'Alembert</u></b>",
      "metadata": "Pat Writer, Literature - European"
    },
    {
      "number": 2,
      "question": "The Mahabharata (\\"muh-hah-BAR-uh-tuh\\") describes this figure, who (*) drove a chariot for Arjuna (\\"AR-juh-nuh\\"). For 10 points, name this Hindu deity.",
      "answer": "<b><u>Krishna</u></b>",
      "metadata": "Pat Writer, Literature - European"
    }
  ],
  "bonuses": [
    {
      "number": 1,
      "leadin": "Answer these questions about a French philosopher, for 10 points each.",
      "parts": [
        "This philosophe (\\"fee-luh-ZOFF\\") edited the Encyclopedie.",
        "Diderot wrote a dialogue about this composer's nephew."
      ],
      "answers": [
        "<b><u>Diderot</u></b>",
        "<b><u>Rameau</u></b>"
      ],
      "values": [
        10,
        10
      ],
      "metadata": "Pat Writer, Literature - European",
      "difficultyModifiers": [
        "e",
        "m"
      ]
    }
  ]
}`;

const qemsYapp2 = `{
  "version": "yapp2/1.0",
  "tossups": [
    {
      "number": 1,
      "question": "Denis Diderot (\\"DID-er-OW\\") edited a famous encyclopedia with this man, who (*) also wrote on mathematics. For 10 points, name this French mathematician.",
      "answer": "<b><u>Jean le Rond d'Alembert</u></b>",
      "metadata": "Pat Writer, Literature - European",
      "anchored": {
        "question": "Denis <pg>Diderot</pg> (\\"DID-er-OW\\") edited a famous encyclopedia with this man, who (*) also wrote on mathematics. For 10 points, name this French mathematician."
      }
    },
    {
      "number": 2,
      "question": "The Mahabharata (\\"muh-hah-BAR-uh-tuh\\") describes this figure, who (*) drove a chariot for Arjuna (\\"AR-juh-nuh\\"). For 10 points, name this Hindu deity.",
      "answer": "<b><u>Krishna</u></b>",
      "metadata": "Pat Writer, Literature - European",
      "anchored": {
        "question": "The <pg>Mahabharata</pg> (\\"muh-hah-BAR-uh-tuh\\") describes this figure, who (*) drove a chariot for <pg>Arjuna</pg> (\\"AR-juh-nuh\\"). For 10 points, name this Hindu deity."
      }
    }
  ],
  "bonuses": [
    {
      "number": 1,
      "leadin": "Answer these questions about a French philosopher, for 10 points each.",
      "parts": [
        "This philosophe (\\"fee-luh-ZOFF\\") edited the Encyclopedie.",
        "Diderot wrote a dialogue about this composer's nephew."
      ],
      "answers": [
        "<b><u>Diderot</u></b>",
        "<b><u>Rameau</u></b>"
      ],
      "values": [
        10,
        10
      ],
      "metadata": "Pat Writer, Literature - European",
      "difficultyModifiers": [
        "e",
        "m"
      ],
      "anchored": {
        "parts": [
          "This <pg>philosophe</pg> (\\"fee-luh-ZOFF\\") edited the Encyclopedie.",
          "Diderot wrote a dialogue about this composer's nephew."
        ]
      }
    }
  ],
  "name": "Round 1"
}`;

function load(packet: IPacket): PacketState {
    const appState: AppState = new AppState();
    appState.uiState.clearPacketStatus();
    const loaded: PacketState | undefined = PacketLoaderController.loadPacket(appState, packet);
    if (loaded == undefined) {
        throw new Error(`Packet failed to load: ${appState.uiState.packetParseStatus?.status.status}`);
    }

    return loaded;
}

describe("Yapp2EndToEndTests", () => {
    const yapp1: IPacket = JSON.parse(qemsYapp1) as IPacket;
    const yapp2: IPacket = JSON.parse(qemsYapp2) as IPacket;

    it("only the YAPP2 file declares a version", () => {
        expect(yapp1.version).to.be.undefined;
        expect(yapp2.version).to.equal("yapp2/1.0");
    });

    it("both packets load", () => {
        expect(load(yapp1).tossups.length).to.equal(2);
        expect(load(yapp2).tossups.length).to.equal(2);
    });

    it("the canonical questions are identical between the two files", () => {
        // The whole backward-compatibility claim: a plain-YAPP reader sees exactly the same packet either way.
        expect(yapp2.tossups.map((tossup) => tossup.question)).to.deep.equal(
            yapp1.tossups.map((tossup) => tossup.question)
        );
        expect(yapp2.tossups.map((tossup) => tossup.answer)).to.deep.equal(
            yapp1.tossups.map((tossup) => tossup.answer)
        );
        expect(yapp2.bonuses?.map((bonus) => bonus.parts)).to.deep.equal(yapp1.bonuses?.map((bonus) => bonus.parts));
        expect(yapp2.bonuses?.map((bonus) => bonus.answers)).to.deep.equal(
            yapp1.bonuses?.map((bonus) => bonus.answers)
        );
    });

    it("no <pg> tag leaks into the canonical fields", () => {
        for (const packet of [yapp1, yapp2]) {
            for (const tossup of packet.tossups) {
                expect(FormattedTextParser.hasPronunciationAnchors(tossup.question)).to.be.false;
                expect(FormattedTextParser.hasPronunciationAnchors(tossup.answer)).to.be.false;
            }

            for (const bonus of packet.bonuses ?? []) {
                expect(bonus.parts.some(FormattedTextParser.hasPronunciationAnchors)).to.be.false;
                expect(bonus.answers.some(FormattedTextParser.hasPronunciationAnchors)).to.be.false;
            }
        }
    });

    it("QEMS's anchors reach MODAQ's formatted text", () => {
        const packet: PacketState = load(yapp2);
        const segments: IFormattedText[] = FormattedTextParser.parseFormattedText(packet.tossups[1].question, {
            pronunciationGuideMarkers: GameFormats.ACFGameFormat.pronunciationGuideMarkers,
        });

        expect(
            segments.filter((segment) => segment.pronunciationTarget === true).map((segment) => segment.text)
        ).to.deep.equal(["Mahabharata", "Arjuna"]);
    });

    it("anchors are absent when the same questions are read as plain YAPP", () => {
        const packet: PacketState = load(yapp1);
        const segments: IFormattedText[] = FormattedTextParser.parseFormattedText(packet.tossups[1].question);
        expect(segments.some((segment) => segment.pronunciationTarget === true)).to.be.false;
    });

    it("anchoring does not move a single buzz point", () => {
        // Why this matters: a guide is unbuzzable non-word text and its anchor is not. If the two were confused,
        // every buzz position after an anchor would shift and scoring off this packet would be wrong.
        const anchoredWords: ITossupWord[] = load(yapp2).tossups[1].getWords(GameFormats.ACFGameFormat);
        const plainWords: ITossupWord[] = load(yapp1).tossups[1].getWords(GameFormats.ACFGameFormat);

        expect(anchoredWords.map((word) => word.word.map((segment) => segment.text).join(""))).to.deep.equal(
            plainWords.map((word) => word.word.map((segment) => segment.text).join(""))
        );
        expect(anchoredWords.map((word) => word.canBuzzOn)).to.deep.equal(plainWords.map((word) => word.canBuzzOn));
        expect(anchoredWords.map((word) => (word.canBuzzOn ? word.wordIndex : -1))).to.deep.equal(
            plainWords.map((word) => (word.canBuzzOn ? word.wordIndex : -1))
        );
    });

    it("the anchored words are still buzzable", () => {
        const words: ITossupWord[] = load(yapp2).tossups[1].getWords(GameFormats.ACFGameFormat);
        const anchored: ITossupWord | undefined = words.find((word) =>
            word.word.some((segment) => segment.pronunciationTarget === true)
        );

        expect(anchored).to.not.be.undefined;
        expect(anchored?.canBuzzOn).to.be.true;
    });

    it("bonus part anchors survive the load", () => {
        const packet: PacketState = load(yapp2);
        const segments: IFormattedText[] = FormattedTextParser.parseFormattedText(
            packet.bonuses[0].parts[0].question,
            { pronunciationGuideMarkers: GameFormats.ACFGameFormat.pronunciationGuideMarkers }
        );
        expect(
            segments.filter((segment) => segment.pronunciationTarget === true).map((segment) => segment.text)
        ).to.deep.equal(["philosophe"]);
    });

    it("the packet name comes through", () => {
        expect(load(yapp2).name).to.equal("Round 1");
    });
});
