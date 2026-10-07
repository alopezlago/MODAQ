import { AppState } from "./AppState";
import { Bonus, Tossup } from "./PacketState";
import { IErratum } from "./IErratum";

export const errataExportVersion = 1;

// Errata get their own export file rather than riding along in the game/QBJ export, since stats programs like
// YellowFruit import those and would choke on (or silently drop) fields they don't know. This file is meant to be
// read by a human or a tournament's own tooling, so each entry repeats enough of the question to identify it
// without the packet at hand.
export interface IErrataExport {
    /**
     * Identifies the file as MODAQ errata, so a director who gets a folder of exports can tell it apart from the
     * QBJ/game files at a glance.
     */
    type: "modaq-errata";

    version: number;

    exportedAt: string;

    round: number | undefined;

    packetName: string | undefined;

    teams: string[];

    errata: IErratumExport[];
}

export interface IErratumExport {
    /**
     * A human-readable label for the question, e.g. "Tossup 7".
     */
    question: string;

    questionType: "tossup" | "bonus";

    /**
     * 1-based number of the question in the packet.
     */
    questionNumber: number;

    /**
     * What the moderator wrote about the error.
     */
    errata: string;

    thrownOut: boolean;

    /**
     * When the moderator recorded it, if known.
     */
    recordedAt?: string;

    /**
     * The question as it appears in the packet, so the erratum can be read without the packet. Bonuses list the
     * leadin and each part.
     */
    questionText?: string;

    answer?: string;

    metadata?: string;
}

/**
 * Builds the errata file for the errata the moderator has recorded. Returns `undefined` when there aren't any.
 */
export function createErrataExport(appState: AppState, round: number | undefined): IErrataExport | undefined {
    const errata: IErratum[] = appState.errata.getSortedErrata();
    if (errata.length === 0) {
        return undefined;
    }

    return {
        type: "modaq-errata",
        version: errataExportVersion,
        exportedAt: new Date().toISOString(),
        round,
        packetName: appState.game.packet.name ?? appState.uiState.packetFilename,
        teams: appState.game.teamNames,
        errata: errata.map((erratum) => convertErratum(appState, erratum)),
    };
}

export function getErrataFilename(appState: AppState, round: number | undefined): string {
    const joinedTeamNames: string = appState.game.teamNames.join("_");
    return `Round_${round}_${joinedTeamNames}_Errata.json`;
}

function convertErratum(appState: AppState, erratum: IErratum): IErratumExport {
    const label: string = erratum.questionType === "bonus" ? "Bonus" : "Tossup";
    const result: IErratumExport = {
        question: `${label} ${erratum.questionNumber}`,
        questionType: erratum.questionType,
        questionNumber: erratum.questionNumber,
        errata: erratum.text,
        thrownOut: erratum.thrownOut,
    };

    if (erratum.at != undefined) {
        result.recordedAt = new Date(erratum.at).toISOString();
    }

    // The question may not be in the packet anymore (or ever, if the number was typed by hand), so only include it
    // when we can find it.
    const index: number = erratum.questionNumber - 1;
    if (erratum.questionType === "tossup") {
        const tossup: Tossup | undefined = appState.game.packet.tossups[index];
        if (tossup != undefined) {
            result.questionText = tossup.question;
            result.answer = tossup.answer;
            result.metadata = tossup.metadata;
        }
    } else {
        const bonus: Bonus | undefined = appState.game.packet.bonuses[index];
        if (bonus != undefined) {
            result.questionText = [bonus.leadin]
                .concat(bonus.parts.map((part, partIndex) => `[${partIndex + 1}] ${part.question}`))
                .join("\n");
            result.answer = bonus.parts.map((part, partIndex) => `[${partIndex + 1}] ${part.answer}`).join("\n");
            result.metadata = bonus.metadata;
        }
    }

    return result;
}
