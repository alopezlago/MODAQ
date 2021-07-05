import { AppState } from "src/state/AppState";
import { IPacket } from "src/state/IPacket";
import { Bonus, IBonusPart, PacketState, Tossup } from "src/state/PacketState";
import { UIState } from "src/state/UIState";

export function loadPacket(appState: AppState, parsedPacket: IPacket): PacketState | undefined
{
    const uiState: UIState = appState.uiState;
    
    if (parsedPacket.tossups == undefined) {
        uiState.setPacketStatus({
            isError: true,
            status: "Error loading packet: Packet doesn't have a tossups field.",
        });
        return;
    }

    const tossups: Tossup[] = parsedPacket.tossups.map((tossup) => new Tossup(tossup.question, tossup.answer));
    let bonuses: Bonus[] = [];

    if (parsedPacket.bonuses) {
        bonuses = parsedPacket.bonuses.map((bonus, index) => {
            if (bonus.answers.length !== bonus.parts.length || bonus.answers.length !== bonus.values.length) {
                const errorMessage = `Error loading packet: Unequal number of parts, answers, and values for bonus ${index}. Answers #: ${bonus.answers.length}, Parts #: ${bonus.parts.length}, Values #: ${bonus.values.length}`;
                uiState.setPacketStatus({
                    isError: true,
                    status: errorMessage,
                });
                throw errorMessage;
            }

            const parts: IBonusPart[] = [];
            for (let i = 0; i < bonus.answers.length; i++) {
                parts.push({
                    answer: bonus.answers[i],
                    question: bonus.parts[i],
                    value: bonus.values[i],
                });
            }

            return new Bonus(bonus.leadin, parts);
        });
    }

    const packet = new PacketState();
    packet.setTossups(tossups);
    packet.setBonuses(bonuses);

    const packetName: string = uiState.packetFilename != undefined ? `"${uiState.packetFilename}"` : "";
    uiState.setPacketStatus({
        isError: false,
        status: `Packet ${packetName} loaded. ${tossups.length} tossup(s), ${bonuses.length} bonus(es).`,
    });

    return packet;
}