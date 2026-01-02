import * as he from "he";

import { AppState } from "../state/AppState";
import { IBonus, IPacket, ITossup } from "../state/IPacket";
import { Bonus, BonusPart, PacketState, Tossup } from "../state/PacketState";
import { UIState } from "../state/UIState";

const minExpectedQuestionLength = 100;

export function loadPacket(parsedPacket: IPacket, existingPacketName?: string | undefined): PacketState | undefined {
    const appState: AppState = AppState.instance;
    const uiState: UIState = appState.uiState;

    if (parsedPacket.tossups == undefined) {
        uiState.setPacketStatus({
            isError: true,
            status: "Error loading packet: Packet doesn't have a tossups field.",
        });
        return;
    }

    const tossups: Tossup[] = parsedPacket.tossups.map(
        (tossup) =>
            new Tossup(
                he.decode(tossup.question),
                he.decode(tossup.answer),
                tossup.metadata ? he.decode(tossup.metadata) : tossup.metadata
            )
    );
    const bonuses: Bonus[] = [];

    if (parsedPacket.bonuses) {
        for (let i = 0; i < parsedPacket.bonuses.length; i++) {
            const bonus: IBonus = parsedPacket.bonuses[i];

            if (bonus.answers.length !== bonus.parts.length || bonus.answers.length !== bonus.values.length) {
                const errorMessage = `Error loading packet: Unequal number of parts, answers, and values for bonus ${
                    i + 1
                }. Answers #: ${bonus.answers.length}, Parts #: ${bonus.parts.length}, Values #: ${
                    bonus.values.length
                }`;
                uiState.setPacketStatus({
                    isError: true,
                    status: errorMessage,
                });
                return;
            }

            const parts: BonusPart[] = [];
            for (let i = 0; i < bonus.answers.length; i++) {
                parts.push({
                    answer: he.decode(bonus.answers[i]),
                    question: he.decode(bonus.parts[i]),
                    value: bonus.values[i],
                    difficultyModifier: bonus.difficultyModifiers ? bonus.difficultyModifiers[i] : undefined,
                });
            }

            bonuses.push(
                new Bonus(he.decode(bonus.leadin), parts, bonus.metadata ? he.decode(bonus.metadata) : bonus.metadata)
            );
        }
    }

    const packet = new PacketState();
    packet.setTossups(tossups);
    packet.setBonuses(bonuses);

    const packetName: string | undefined = parsedPacket.name ?? uiState.packetFilename;
    const packetNameInQuotes: string = packetName != undefined ? `"${packetName}"` : "";
    uiState.setPacketStatus(
        {
            isError: false,
            status: `Packet ${packetNameInQuotes} loaded. ${tossups.length} tossup(s), ${bonuses.length} bonus(es).`,
        },
        findWarnings(packet)
    );

    // If we have an existing packet, don't overwrite the name
    if (existingPacketName) {
        packet.setName(existingPacketName);
    } else if (packetName) {
        packet.setName(packetName);
    }

    return packet;
}

function findWarnings(packet: PacketState): string[] {
    const warnings: string[] = [];

    // Unexpected number of bonus parts
    const maxPartsCount: Map<number, number> = new Map<number, number>();
    for (const bonus of packet.bonuses) {
        const partsCount: number = bonus.parts.length;
        maxPartsCount.set(partsCount, 1 + (maxPartsCount.get(partsCount) ?? 0));
    }

    if (maxPartsCount.size > 1) {
        let maxCountCount = 0;
        let maxCountCandidate = 3;
        for (const candidate of maxPartsCount.keys()) {
            const candidateCount: number = maxPartsCount.get(candidate) ?? 0;
            if (candidateCount > maxCountCount) {
                maxCountCount = candidateCount;
                maxCountCandidate = candidate;
            }
        }

        const badBonusNumbers: number[] = [];
        for (let i = 0; i < packet.bonuses.length; i++) {
            const bonus: Bonus = packet.bonuses[i];
            if (bonus.parts.length != maxCountCandidate) {
                badBonusNumbers.push(i + 1);
            }
        }

        if (badBonusNumbers.length > 0) {
            warnings.push(
                `Bonuses that aren't ${maxCountCandidate} parts long found at bonus(es) ${badBonusNumbers.join(", ")}.`
            );
        }
    }

    // Unexpectedly short question
    const shortQuestionNumbers: number[] = [];
    for (let i = 0; i < packet.tossups.length; i++) {
        const tossup: ITossup = packet.tossups[i];
        if (tossup.question.length < minExpectedQuestionLength) {
            shortQuestionNumbers.push(i + 1);
        }
    }

    if (shortQuestionNumbers.length > 0) {
        warnings.push(`Suspiciously short questions found at tossup(s) ${shortQuestionNumbers.join(", ")}.`);
    }

    return warnings;
}
