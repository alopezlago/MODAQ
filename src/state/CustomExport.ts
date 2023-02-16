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
    cycles: ICycle[];
    players: IPlayer[];
    packet: IPacket;
}

interface ICustomRawExport extends IBaseCustomExport {
    onExport: (fields: IExportFields) => Promise<IStatus>;
    type: "Raw";
}

interface ICustomQBJExport extends IBaseCustomExport {
    onExport: (qbj: IMatch) => Promise<IStatus>;
    type: "QBJ";
}

interface IBaseCustomExport {
    label: string;

    /**
     * If defined, how often the customExport handler should be called in milliseconds. Setting this to null or undefined
     * will stop calling the customExport handler automatically.
     * The smallest interval allowed is 5000 milliseconds.
     */
    customExportInterval?: number;
}

export type ExportType = "Raw" | "QBJ";
