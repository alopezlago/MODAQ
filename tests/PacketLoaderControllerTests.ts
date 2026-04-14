import { assert, expect } from "chai";

import * as PacketLoaderController from "src/components/PacketLoaderController";
import { AppState } from "src/state/AppState";
import { PacketState, Tossup } from "src/state/PacketState";

const validTossup: Tossup = new Tossup(
    "His residence was Mount Vernon. Name this man, who was the first president of the United States of America.",
    "George Washington"
);

function initializeApp(): AppState {
    AppState.resetInstance();
    const appState: AppState = AppState.instance;
    appState.uiState.clearPacketStatus();

    return appState;
}

describe("PacketLoaderControllerTests", () => {
    it("undefined tossups field", () => {
        const appState: AppState = initializeApp();
        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: (undefined as unknown) as Tossup[],
        });

        expect(packet).to.be.undefined;
        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.true;
    });

    it("different bonus parts and answers count", () => {
        const appState: AppState = initializeApp();
        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: [new Tossup("Q1", "A1", "Metadata")],
            bonuses: [
                {
                    leadin: "Leadin",
                    parts: ["Only one part"],
                    answers: ["But two", "Answers"],
                    values: [10],
                },
            ],
        });

        expect(packet).to.be.undefined;
        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.true;
    });

    it("different bonus parts and values count", () => {
        const appState: AppState = initializeApp();
        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: [new Tossup("Q1", "A1", "Metadata")],
            bonuses: [
                {
                    leadin: "Leadin",
                    parts: ["Only one part"],
                    answers: ["One Answer"],
                    values: [10, 10],
                },
            ],
        });

        expect(packet).to.be.undefined;
        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.true;
    });

    it("valid packet", () => {
        const appState: AppState = initializeApp();
        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: [validTossup],
            bonuses: [
                {
                    leadin: "Leadin",
                    parts: ["Only one part"],
                    answers: ["One Answer"],
                    values: [10],
                },
                {
                    leadin: "Leadin 2",
                    parts: ["Only one part again"],
                    answers: ["One Answer"],
                    values: [10],
                },
            ],
        });

        if (packet == undefined) {
            assert.fail("Packet was undefined");
        }

        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.false;
        expect(appState.uiState.packetParseStatus?.warnings.length).to.equal(0);

        expect(packet.tossups.length).to.equal(1);
        expect(packet.bonuses.length).to.equal(2);
    });

    it("packet with short tossup", () => {
        const appState: AppState = initializeApp();
        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: [new Tossup("His residence was Mount Vernon. Name", "George Washington")],
            bonuses: [
                {
                    leadin: "Leadin",
                    parts: ["Only one part"],
                    answers: ["One Answer"],
                    values: [10],
                },
                {
                    leadin: "Leadin 2",
                    parts: ["Only one part again"],
                    answers: ["One Answer"],
                    values: [10],
                },
            ],
        });

        if (packet == undefined) {
            assert.fail("Packet was undefined");
        }

        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.false;
        expect(appState.uiState.packetParseStatus?.warnings.length).to.equal(1);

        expect(packet.tossups.length).to.equal(1);
        expect(packet.bonuses.length).to.equal(2);
    });

    it("packet with short inconsistent bonus parts", () => {
        const appState: AppState = initializeApp();
        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: [validTossup],
            bonuses: [
                {
                    leadin: "Leadin",
                    parts: ["Only one part"],
                    answers: ["One Answer"],
                    values: [10],
                },
                {
                    leadin: "Leadin 2",
                    parts: ["Only one part again"],
                    answers: ["One Answer"],
                    values: [10],
                },
                {
                    leadin: "Leadin 3",
                    parts: ["Two parts now", "That's right"],
                    answers: ["One Answer", "Two Answer"],
                    values: [10, 10],
                },
            ],
        });

        if (packet == undefined) {
            assert.fail("Packet was undefined");
        }

        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.false;
        expect(appState.uiState.packetParseStatus?.warnings.length).to.equal(1);

        expect(packet.tossups.length).to.equal(1);
        expect(packet.bonuses.length).to.equal(3);
    });

    it("packet with mixed power markers warns about missing powers", () => {
        const appState: AppState = initializeApp();
        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: [
                new Tossup(
                    "This tossup includes an early power mark (*) and has enough words to avoid short-question warnings entirely in this test case.",
                    "Answer One"
                ),
                new Tossup(
                    "This tossup intentionally omits the power marker but is still comfortably above the minimum expected length for a question warning.",
                    "Answer Two"
                ),
                new Tossup(
                    "This tossup also omits the marker and remains long enough to ensure only the missing-powers warning is produced for this packet.",
                    "Answer Three"
                ),
            ],
            bonuses: [],
        });

        if (packet == undefined) {
            assert.fail("Packet was undefined");
        }

        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.false;
        expect(appState.uiState.packetParseStatus?.warnings.length).to.equal(1);
        expect(appState.uiState.packetParseStatus?.warnings[0]).to.equal("Some tossup(s) missing powers: 2, 3.");

        expect(packet.tossups.length).to.equal(3);
        expect(packet.bonuses.length).to.equal(0);
    });

    it("packet with no power markers does not warn about missing powers", () => {
        const appState: AppState = initializeApp();
        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: [
                new Tossup(
                    "This tossup is long enough to avoid short warnings and has no power marker because the format can legitimately omit powers.",
                    "Answer One"
                ),
                new Tossup(
                    "Another sufficiently long tossup without a marker keeps this test focused on verifying that no missing-powers warning is emitted.",
                    "Answer Two"
                ),
            ],
            bonuses: [],
        });

        if (packet == undefined) {
            assert.fail("Packet was undefined");
        }

        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.false;
        expect(appState.uiState.packetParseStatus?.warnings.length).to.equal(0);

        expect(packet.tossups.length).to.equal(2);
        expect(packet.bonuses.length).to.equal(0);
    });

    it("packet with all power markers does not warn about missing powers", () => {
        const appState: AppState = initializeApp();
        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: [
                new Tossup(
                    "This tossup includes the marker (*) and has enough words to avoid short-question warnings while confirming consistent power formatting.",
                    "Answer One"
                ),
                new Tossup(
                    "A second tossup also includes (*) and remains comfortably above the minimum expected length so only missing-power behavior is under test.",
                    "Answer Two"
                ),
                new Tossup(
                    "The third tossup contains (*) as well and is intentionally verbose to ensure no short tossup warnings interfere with this assertion.",
                    "Answer Three"
                ),
            ],
            bonuses: [],
        });

        if (packet == undefined) {
            assert.fail("Packet was undefined");
        }

        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.false;
        expect(appState.uiState.packetParseStatus?.warnings.length).to.equal(0);

        expect(packet.tossups.length).to.equal(3);
        expect(packet.bonuses.length).to.equal(0);
    });

    it("packet is renamed", () => {
        const appState: AppState = initializeApp();
        appState.uiState.setPacketFilename("uiPacketName");

        const packet: PacketState | undefined = PacketLoaderController.loadPacket({
            tossups: [validTossup],
            bonuses: [],
        });

        if (packet == undefined) {
            assert.fail("First packet was undefined");
        }

        expect(packet.name).to.equal("uiPacketName");

        packet.setName("old");

        const packet2: PacketState | undefined = PacketLoaderController.loadPacket(
            {
                tossups: [
                    new Tossup(
                        "His residence was Mount Vernon. He decried the concept of political parties in his farewell address. Name this first president of the Untied States.",
                        "George Washington"
                    ),
                ],
                bonuses: [],
            },
            packet.name
        );

        if (packet2 == undefined) {
            assert.fail("Second packet was undefined");
        }

        expect(appState.uiState.packetParseStatus).to.not.be.undefined;
        expect(appState.uiState.packetParseStatus?.status.isError).to.be.false;
        expect(appState.uiState.packetParseStatus?.warnings.length).to.equal(0);

        expect(packet2.tossups.length).to.equal(1);
        expect(packet2.bonuses.length).to.equal(0);
        expect(packet2.name).to.equal(packet.name);
    });
});
