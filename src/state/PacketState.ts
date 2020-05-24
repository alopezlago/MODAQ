import { observable } from 'mobx';

export class PacketState {
    @observable
    public tossups: Tossup[];

    @observable
    public bonsues: Bonus[];

    constructor() {
        this.tossups = [];
        this.bonsues = [];
    }
}

export interface IQuestion {
    question: string;
    answer: string;
}

export class Tossup implements IQuestion {
    public question: string;
    public answer: string;
}

export class Bonus {
    public leadin: string;
    public parts: IQuestion[];
}