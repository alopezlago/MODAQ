import { toJS } from "mobx";
import { IStatus } from "../IStatus";
import { IMatch } from "../qbj/QBJ";
import { hasPronunciationAnchors, stripPronunciationAnchors } from "../parser/FormattedTextParser";

import { ICycle } from "./Cycle";
import { GameState } from "./GameState";
import { IAnchoredBonusText, IAnchoredTossupText, IPacket, yapp2Version } from "./IPacket";
import { IPlayer } from "./TeamState";

// A packet loaded from YAPP2 keeps its <pg> anchors in the question text, so the export has to split them back out:
// canonical fields free of the tag (what a plain-YAPP consumer expects) plus the anchored copies, exactly as YAPP2
// defines. Questions with no anchor are untouched and produce no `anchored` object.
function anchoredTossupText(question: string, answer: string): IAnchoredTossupText | undefined {
    const fields: IAnchoredTossupText = {};
    if (hasPronunciationAnchors(question)) {
        fields.question = question;
    }
    if (hasPronunciationAnchors(answer)) {
        fields.answer = answer;
    }
    return Object.keys(fields).length > 0 ? fields : undefined;
}

function anchoredBonusText(leadin: string, parts: string[], answers: string[]): IAnchoredBonusText | undefined {
    const fields: IAnchoredBonusText = {};
    if (hasPronunciationAnchors(leadin)) {
        fields.leadin = leadin;
    }
    if (parts.some(hasPronunciationAnchors)) {
        fields.parts = parts;
    }
    if (answers.some(hasPronunciationAnchors)) {
        fields.answers = answers;
    }
    return Object.keys(fields).length > 0 ? fields : undefined;
}

export function convertGameToExportFields(game: GameState): IExportFields {
    let anchored = false;

    const tossups = game.packet.tossups.map((tossup, index) => {
        const anchoredText: IAnchoredTossupText | undefined = anchoredTossupText(tossup.question, tossup.answer);
        anchored = anchored || anchoredText != undefined;
        return toJS({
            answer: stripPronunciationAnchors(tossup.answer),
            question: stripPronunciationAnchors(tossup.question),
            number: index + 1,
            ...(anchoredText ? { anchored: anchoredText } : {}),
        });
    });

    const bonuses = game.packet.bonuses?.map((bonus, index) => {
        const parts: string[] = bonus.parts.map((part) => part.question);
        const answers: string[] = bonus.parts.map((part) => part.answer);
        const anchoredText: IAnchoredBonusText | undefined = anchoredBonusText(bonus.leadin, parts, answers);
        anchored = anchored || anchoredText != undefined;
        return {
            leadin: stripPronunciationAnchors(bonus.leadin),
            answers: answers.map(stripPronunciationAnchors),
            number: index + 1,
            parts: parts.map(stripPronunciationAnchors),
            values: bonus.parts.map((part) => part.value),
            difficultyModifiers: bonus.parts.every((part) => part.difficultyModifier != undefined)
                ? bonus.parts.map((part) => part.difficultyModifier as string)
                : undefined,
            ...(anchoredText ? { anchored: anchoredText } : {}),
        };
    });

    // A reading order the packet arrived with is written back out: it describes the packet, not the game, so dropping
    // it would quietly turn an interlaced packet into an ordinary one on the next round trip.
    const readingOrder = game.packet.readingOrder;
    const isYapp2: boolean = anchored || readingOrder != undefined;

    return {
        cycles: toJS(game.cycles),
        players: toJS(game.players),
        packet: {
            // Only claim YAPP2 when something actually uses it; otherwise this stays a plain YAPP packet.
            ...(isYapp2 ? { version: yapp2Version } : {}),
            tossups,
            bonuses,
            ...(readingOrder ? { readingOrder: toJS(readingOrder) } : {}),
        },
    };
}

export type ICustomExport = ICustomRawExport | ICustomQBJExport;

export interface IExportFields {
    /**
     * The cycles for the current game. Each element represents a tossup/bonus cycle in the game, and stores all events
     * that occurred in that cycle.
     */
    cycles: ICycle[];

    /**
     * The players in the current game. This has players from every team. Team order isn't guaranteed.
     */
    players: IPlayer[];

    /**
     * The packet used in the current game
     */
    packet: IPacket;
}

export interface IExportContext {
    /**
     * How the export was created. It could be exported from the export menu item, from the export prompt when saving
     * a new game, from the export prompt when clicking on Next on the last tossup, or from a timer event.
     */
    source: ExportSource;
}

interface ICustomRawExport extends IBaseCustomExport {
    /**
     * Callback for exporting the game
     * @param fields All the fields needed to represent the current game
     * @param context The context for the export, such as how the export was started
     * @returns An `IStatus` indicating if the export was successful
     */
    onExport: (fields: IExportFields, context?: IExportContext) => Promise<IStatus>;
    type: "Raw";
}

interface ICustomQBJExport extends IBaseCustomExport {
    /**
     * Callback for exporting the game
     * @param qbj QBJ Match of the current game
     * @param context The context for the export, such as how the export was started
     * @returns An `IStatus` indicating if the export was successful
     */
    onExport: (qbj: IMatch, context?: IExportContext) => Promise<IStatus>;
    type: "QBJ";
}

interface IBaseCustomExport {
    /**
     * Label text of the export button in the menu
     */
    label: string;

    /**
     * If defined, how often the customExport handler should be called in milliseconds. Setting this to null or undefined
     * will stop calling the customExport handler automatically.
     * The smallest interval allowed is 5000 milliseconds.
     */
    customExportInterval?: number;
}

export type ExportType = "Raw" | "QBJ";

export type ExportSource = "Menu" | "NewGame" | "NextButton" | "Timer";
