import { expect } from "chai";

import * as CustomExport from "src/state/CustomExport";
import * as GameFormats from "src/state/GameFormats";
import { GameState } from "src/state/GameState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { IExportFields } from "src/state/CustomExport";
import { ITossup, IBonus } from "src/state/IPacket";

function exportPacket(packet: PacketState): IExportFields {
    const game: GameState = new GameState();
    game.loadPacket(packet);
    game.setGameFormat(GameFormats.ACFGameFormat);
    return CustomExport.convertGameToExportFields(game);
}

function packetWith(tossups: Tossup[], bonuses: Bonus[] = []): PacketState {
    const packet: PacketState = new PacketState();
    packet.setTossups(tossups);
    packet.setBonuses(bonuses);
    return packet;
}

describe("CustomExportTests", () => {
    // A packet loaded from YAPP2 keeps its <pg> anchors in the question text, so the export has to hand them back the
    // way YAPP2 defines: canonical fields free of the tag, anchors in a parallel `anchored` object.
    describe("YAPP2 pronunciation anchors", () => {
        it("no anchors produces a plain YAPP packet", () => {
            const fields: IExportFields = exportPacket(packetWith([new Tossup("A plain question.", "An answer")]));

            expect(fields.packet.version).to.be.undefined;
            expect(fields.packet.tossups[0].question).to.equal("A plain question.");
            expect(fields.packet.tossups[0].anchored).to.be.undefined;
        });

        it("anchors are split out of the canonical fields", () => {
            const fields: IExportFields = exportPacket(
                packetWith([new Tossup('Denis <pg>Diderot</pg> ("DID-er-OW") wrote this.', "Denis Diderot")])
            );

            expect(fields.packet.version).to.equal("yapp2/1.0");

            const tossup: ITossup = fields.packet.tossups[0];
            // Canonical text is what a plain-YAPP reader needs: no tag, words intact.
            expect(tossup.question).to.equal('Denis Diderot ("DID-er-OW") wrote this.');
            expect(tossup.anchored?.question).to.equal('Denis <pg>Diderot</pg> ("DID-er-OW") wrote this.');
            // The answer had no anchor, so it isn't duplicated.
            expect(tossup.anchored?.answer).to.be.undefined;
        });

        it("a packet mixing anchored and plain questions only marks the anchored one", () => {
            const fields: IExportFields = exportPacket(
                packetWith([
                    new Tossup("No anchor at all here.", "Answer one"),
                    new Tossup("An <pg>anchor</pg> here.", "Answer two"),
                ])
            );

            expect(fields.packet.version).to.equal("yapp2/1.0");
            expect(fields.packet.tossups[0].anchored).to.be.undefined;
            expect(fields.packet.tossups[1].anchored?.question).to.equal("An <pg>anchor</pg> here.");
            expect(fields.packet.tossups[1].question).to.equal("An anchor here.");
        });

        it("bonus leadin, parts, and answers are split out", () => {
            const fields: IExportFields = exportPacket(
                packetWith(
                    [new Tossup("A plain question.", "An answer")],
                    [
                        new Bonus("A <pg>leadin</pg> here.", [
                            { question: "Part <pg>one</pg>.", answer: "Answer one", value: 10 },
                            { question: "Part two.", answer: "Answer <pg>two</pg>.", value: 10 },
                        ]),
                    ]
                )
            );

            const bonus: IBonus | undefined = fields.packet.bonuses?.[0];
            expect(bonus).to.not.be.undefined;
            if (bonus == undefined) {
                return;
            }

            expect(bonus.leadin).to.equal("A leadin here.");
            expect(bonus.parts).to.deep.equal(["Part one.", "Part two."]);
            expect(bonus.answers).to.deep.equal(["Answer one", "Answer two."]);

            expect(bonus.anchored?.leadin).to.equal("A <pg>leadin</pg> here.");
            // Arrays come back full length so they can be indexed alongside the canonical ones.
            expect(bonus.anchored?.parts).to.deep.equal(["Part <pg>one</pg>.", "Part two."]);
            expect(bonus.anchored?.answers).to.deep.equal(["Answer one", "Answer <pg>two</pg>."]);
        });
    });
});
