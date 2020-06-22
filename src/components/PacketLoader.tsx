import React from "react";

import { GameState } from "src/state/GameState";
import { UIState } from "src/state/UIState";

// TODO: Find out why Webpack needs the path in this relative form, while it doesn't for other imports
import { Tossup, Bonus, IBonusPart, PacketState } from "src/state/PacketState";
import { FileInput } from "./FileInput";

export const PacketLoader = (props: IPacketLoaderProps): JSX.Element => {
    const onLoadHandler = React.useCallback((ev: ProgressEvent<FileReader>) => onLoad(ev, props), [props]);

    return <FileInput onLoad={onLoadHandler} />;
};

function onLoad(ev: ProgressEvent<FileReader>, props: IPacketLoaderProps): void {
    // TODO: This should appear in the UI. Maybe set something in UIState.
    if (typeof ev.target?.result !== "string") {
        throw "Error loading packet: Bad file; we expected a filename.";
    }

    const parsedPacket: IPacket = JSON.parse(ev.target.result) as IPacket;
    if (parsedPacket.tossups == undefined) {
        throw "Error loading packet: Packet doesn't have a tossups field.";
    }

    const tossups: Tossup[] = parsedPacket.tossups.map((tossup) => new Tossup(tossup.question, tossup.answer));
    let bonuses: Bonus[] = [];

    if (parsedPacket.bonuses) {
        bonuses = parsedPacket.bonuses.map((bonus, index) => {
            if (bonus.answers.length !== bonus.parts.length || bonus.answers.length !== bonus.values.length) {
                throw `Error loading packet: Unequal number of parts, answers, and values for bonus ${index}. Answers #: ${bonus.answers.length}, Parts #: ${bonus.parts.length}, Values #: ${bonus.values.length}`;
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

    props.game.loadPacket(packet);

    props.onLoad(packet);
}

export interface IPacketLoaderProps {
    game: GameState;
    uiState: UIState;

    onLoad(packet: PacketState): void;
}

// TODO: Should this be moved outside of the component? So we can test it
interface IPacket {
    tossups: ITossup[];
    bonuses?: IBonus[];
}

interface ITossup {
    question: string;
    answer: string;
    number: number;
}

interface IBonus {
    leadin: string;
    parts: string[];
    answers: string[];
    number: number;
    values: number[];
}
