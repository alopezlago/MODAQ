import { toJS } from "mobx";
import { IStatus } from "../IStatus";
import { IMatch } from "../qbj/QBJ";

import { ICycle } from "./Cycle";
import { GameState } from "./GameState";
import { IPacket } from "./IPacket";
import { IPlayer } from "./TeamState";

export function convertGameToExportFields(game: GameState): IExportFields {
    return {
        cycles: toJS(game.cycles),
        players: toJS(game.players),
        packet: {
            tossups: game.packet.tossups.map((tossup, index) => {
                return toJS({
                    answer: tossup.answer,
                    question: tossup.question,
                    number: index + 1,
                });
            }),
            bonuses: game.packet.bonuses?.map((bonus, index) => {
                return {
                    leadin: bonus.leadin,
                    answers: bonus.parts.map((part) => part.answer),
                    number: index + 1,
                    parts: bonus.parts.map((part) => part.question),
                    values: bonus.parts.map((part) => part.value),
                    difficultyModifiers: bonus.parts.every((part) => part.difficultyModifier != undefined)
                        ? bonus.parts.map((part) => part.difficultyModifier as string)
                        : undefined,
                };
            }),
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
