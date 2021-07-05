export interface IPacket {
    tossups: ITossup[];
    bonuses?: IBonus[];
}

export interface ITossup {
    question: string;
    answer: string;
    number: number;
}

export interface IBonus {
    leadin: string;
    parts: string[];
    answers: string[];
    number: number;
    values: number[];
}
