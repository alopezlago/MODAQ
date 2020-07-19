import { observable, action } from "mobx";

export class PacketState {
    @observable
    public tossups: Tossup[];

    @observable
    public bonuses: Bonus[];

    constructor() {
        this.tossups = [];
        this.bonuses = [];
    }

    @action
    public setTossups(tossups: Tossup[]): void {
        this.tossups = tossups;
    }

    @action
    public setBonuses(bonuses: Bonus[]): void {
        this.bonuses = bonuses;
    }
}

export interface IQuestion {
    question: string;
    answer: string;
}

export class IBonusPart implements IQuestion {
    public question: string;
    public answer: string;
    public value: number;

    constructor(question: string, answer: string, value = 10) {
        this.question = question;
        this.answer = answer;
        this.value = value;
    }
}

export class Tossup implements IQuestion {
    public question: string;
    public answer: string;

    constructor(question: string, answer: string) {
        this.question = question;
        this.answer = answer;
    }
}

export class Bonus {
    public leadin: string;

    @observable
    public parts: IBonusPart[];

    constructor(leadin: string, parts: IBonusPart[]) {
        this.leadin = leadin;
        this.parts = parts;
    }
}
