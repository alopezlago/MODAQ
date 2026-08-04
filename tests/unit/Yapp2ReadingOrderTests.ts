import { expect } from "chai";

import * as PacketLoaderController from "src/components/PacketLoaderController";
import { AppState } from "src/state/AppState";
import { IBonus, IPacket, IReadingOrderEntry, ITossup } from "src/state/IPacket";
import { PacketState } from "src/state/PacketState";

// YAPP2 1.1's readingOrder: the order a packet is read in when it isn't all tossups then all bonuses. It only points
// at the canonical arrays, so a malformed one is discarded whole rather than partly applied. See YAPP2_FORMAT.md.

function initializeApp(): AppState {
    const appState: AppState = new AppState();
    appState.uiState.clearPacketStatus();

    return appState;
}

function tossup(n: number): ITossup {
    return { question: `Tossup ${n} question`, answer: `Answer ${n}` };
}

function bonus(n: number): IBonus {
    return {
        leadin: `Bonus ${n} leadin`,
        parts: [`Part ${n}`],
        answers: [`Bonus answer ${n}`],
        values: [10],
    };
}

const interlaced: IReadingOrderEntry[] = [
    { type: "tossup", index: 0 },
    { type: "bonus", index: 0 },
    { type: "tossup", index: 1 },
    { type: "bonus", index: 1 },
];

function packetWith(readingOrder: unknown, version = "yapp2/1.1"): IPacket {
    return ({
        version,
        tossups: [tossup(1), tossup(2)],
        bonuses: [bonus(1), bonus(2)],
        readingOrder,
    } as unknown) as IPacket;
}

/** The same packet with no `version` at all — passing `undefined` would just take the default above. */
function plainYappPacketWith(readingOrder: unknown): IPacket {
    const packet: IPacket = packetWith(readingOrder);
    delete (packet as { version?: string }).version;
    return packet;
}

function load(packet: IPacket): PacketState | undefined {
    return PacketLoaderController.loadPacket(initializeApp(), packet);
}

describe("Yapp2ReadingOrderTests", () => {
    it("a valid order is kept", () => {
        const packet: PacketState | undefined = load(packetWith(interlaced));
        expect(packet).to.not.be.undefined;
        expect(packet?.readingOrder).to.deep.equal(interlaced);
    });

    it("a packet without one reads in the default order", () => {
        const packet: PacketState | undefined = load(packetWith(undefined));
        expect(packet).to.not.be.undefined;
        expect(packet?.readingOrder).to.be.undefined;
    });

    it("it is ignored without the YAPP2 version marker", () => {
        // A file that doesn't declare YAPP2 hasn't promised anything about the field.
        const packet: PacketState | undefined = load(plainYappPacketWith(interlaced));
        expect(packet).to.not.be.undefined;
        expect(packet?.readingOrder).to.be.undefined;
    });

    it("later 1.x versions are accepted", () => {
        const packet: PacketState | undefined = load(packetWith(interlaced, "yapp2/1.9"));
        expect(packet?.readingOrder).to.deep.equal(interlaced);
    });

    it("an order missing a question is discarded whole", () => {
        const packet: PacketState | undefined = load(packetWith(interlaced.slice(0, 3)));
        expect(packet).to.not.be.undefined;
        expect(packet?.readingOrder).to.be.undefined;
    });

    it("a duplicate entry is discarded whole", () => {
        const duplicated: IReadingOrderEntry[] = [
            { type: "tossup", index: 0 },
            { type: "bonus", index: 0 },
            { type: "tossup", index: 0 },
            { type: "bonus", index: 1 },
        ];
        expect(load(packetWith(duplicated))?.readingOrder).to.be.undefined;
    });

    it("an index out of range is discarded whole", () => {
        const outOfRange: IReadingOrderEntry[] = [
            { type: "tossup", index: 0 },
            { type: "bonus", index: 0 },
            { type: "tossup", index: 1 },
            { type: "bonus", index: 7 },
        ];
        expect(load(packetWith(outOfRange))?.readingOrder).to.be.undefined;
    });

    it("an unknown question type is discarded whole", () => {
        const badType = [
            { type: "tossup", index: 0 },
            { type: "bonus", index: 0 },
            { type: "tossup", index: 1 },
            { type: "lightning", index: 1 },
        ];
        expect(load(packetWith(badType))?.readingOrder).to.be.undefined;
    });

    it("a non-array is discarded", () => {
        expect(load(packetWith(true))?.readingOrder).to.be.undefined;
    });

    it("the questions are loaded either way", () => {
        // Whatever happens to the field, the packet itself must come through whole — that's what makes it safe to
        // ignore a bad one.
        const packet: PacketState | undefined = load(packetWith([{ type: "tossup", index: 99 }]));
        expect(packet?.tossups.length).to.equal(2);
        expect(packet?.bonuses.length).to.equal(2);
        expect(packet?.tossups[0].question).to.equal("Tossup 1 question");
    });
});
