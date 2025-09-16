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
