export interface IPacket {
    tossups: ITossup[];
    bonuses?: IBonus[];
}

export interface ITossup {
    question: string;
    answer: string;
    metadata?: string;
}

export interface IBonus {
    leadin: string;
    parts: string[];
    answers: string[];
    values: number[];
    difficultyModifiers?: string[];
    metadata?: string;
}
