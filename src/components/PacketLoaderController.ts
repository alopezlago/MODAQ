import * as he from "he";

import { AppState } from "../state/AppState";
import { IBonus, IPacket, IReadingOrderEntry, ITossup, yapp2VersionPrefix } from "../state/IPacket";
import { Bonus, BonusPart, PacketState, Tossup } from "../state/PacketState";
import { UIState } from "../state/UIState";

const minExpectedQuestionLength = 100;

/**
 * `true` if the packet declares itself as YAPP2, which means its questions may carry `anchored` text with `<pg>`
 * pronunciation guide anchors. See YAPP2_FORMAT.md.
 */
function isYapp2(packet: IPacket): boolean {
    return packet.version != undefined && packet.version.toLowerCase().startsWith(yapp2VersionPrefix);
}

/**
 * The anchored form of a field when the packet is YAPP2 and supplies one, else the canonical text. We understand
 * `<pg>`, so preferring the anchored text loses nothing: the two differ only by that tag.
 */
function anchoredOr(canonical: string, anchored: string | undefined, useAnchored: boolean): string {
    return useAnchored && anchored != undefined ? anchored : canonical;
}

/**
 * The anchored forms of an array field, used only when it lines up with the canonical array. Parts and answers are
 * matched up by index, so a mismatched length means the anchored copy can't be trusted and is ignored.
 */
function anchoredArrayOr(canonical: string[], anchored: string[] | undefined, useAnchored: boolean): string[] {
    return useAnchored && anchored != undefined && anchored.length === canonical.length ? anchored : canonical;
}

/**
 * The packet's `readingOrder` if it's one we can trust, else `undefined`.
 *
 * The field only ever reorders, so it has to name every question exactly once. Anything else — an index out of range,
 * a duplicate, a question left out — is discarded whole rather than partly applied: half an order would drop or
 * repeat questions in the middle of a packet, which is worse than falling back to the default reading order.
 */
export function validatedReadingOrder(
    packet: IPacket,
    useAnchored: boolean,
    tossupCount: number,
    bonusCount: number
): IReadingOrderEntry[] | undefined {
    const order: IReadingOrderEntry[] | undefined = packet.readingOrder;
    if (!useAnchored || order == undefined) {
        return undefined;
    }

    if (!Array.isArray(order) || order.length !== tossupCount + bonusCount) {
        return undefined;
    }

    const seen: Set<string> = new Set<string>();
    for (const entry of order) {
        if (entry == undefined || (entry.type !== "tossup" && entry.type !== "bonus")) {
            return undefined;
        }

        const limit: number = entry.type === "tossup" ? tossupCount : bonusCount;
        if (!Number.isInteger(entry.index) || entry.index < 0 || entry.index >= limit) {
            return undefined;
        }

        const key = `${entry.type}|${entry.index}`;
        if (seen.has(key)) {
            return undefined;
        }

        seen.add(key);
    }

    // Every slot filled and nothing repeated, so by counting it covers them all.
    return order;
}

export function loadPacket(
    appState: AppState,
    parsedPacket: IPacket,
    existingPacketName?: string | undefined
): PacketState | undefined {
    const uiState: UIState = appState.uiState;

    if (parsedPacket.tossups == undefined) {
        uiState.setPacketStatus({
            isError: true,
            status: "Error loading packet: Packet doesn't have a tossups field.",
        });
        return;
    }

    const useAnchored: boolean = isYapp2(parsedPacket);

    const tossups: Tossup[] = parsedPacket.tossups.map(
        (tossup) =>
            new Tossup(
                he.decode(anchoredOr(tossup.question, tossup.anchored?.question, useAnchored)),
                he.decode(anchoredOr(tossup.answer, tossup.anchored?.answer, useAnchored)),
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

            const bonusParts: string[] = anchoredArrayOr(bonus.parts, bonus.anchored?.parts, useAnchored);
            const bonusAnswers: string[] = anchoredArrayOr(bonus.answers, bonus.anchored?.answers, useAnchored);

            const parts: BonusPart[] = [];
            for (let i = 0; i < bonus.answers.length; i++) {
                parts.push({
                    answer: he.decode(bonusAnswers[i]),
                    question: he.decode(bonusParts[i]),
                    value: bonus.values[i],
                    difficultyModifier: bonus.difficultyModifiers ? bonus.difficultyModifiers[i] : undefined,
                });
            }

            bonuses.push(
                new Bonus(
                    he.decode(anchoredOr(bonus.leadin, bonus.anchored?.leadin, useAnchored)),
                    parts,
                    bonus.metadata ? he.decode(bonus.metadata) : bonus.metadata
                )
            );
        }
    }

    const packet = new PacketState();
    packet.setTossups(tossups);
    packet.setBonuses(bonuses);
    packet.setReadingOrder(validatedReadingOrder(parsedPacket, useAnchored, tossups.length, bonuses.length));

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

    // Format with powers where not every question has powers. We don't know the format at this point, so
    // look for the default power marker "(*)".
    const tossupsWithoutPowers: number[] = [];
    let hasPowers = false;
    for (let i = 0; i < packet.tossups.length; i++) {
        const tossup: ITossup = packet.tossups[i];
        if (tossup.question.includes("(*)")) {
            hasPowers = true;
        } else {
            tossupsWithoutPowers.push(i + 1);
        }
    }

    if (hasPowers && tossupsWithoutPowers.length > 0) {
        warnings.push(`Some tossup(s) missing powers: ${tossupsWithoutPowers.join(", ")}.`);
    }

    return warnings;
}
