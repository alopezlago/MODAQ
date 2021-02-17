import { observable, makeObservable, makeAutoObservable } from "mobx";

export class PacketState {
    public tossups: Tossup[];

    public bonuses: Bonus[];

    constructor() {
        makeAutoObservable(this);

        this.tossups = [];
        this.bonuses = [];
    }

    public setTossups(tossups: Tossup[]): void {
        this.tossups = tossups;
    }

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

    public parts: IBonusPart[];

    constructor(leadin: string, parts: IBonusPart[]) {
        // We don't use makeAutoObservable because leadin doesn't need to be observable (never changes)
        makeObservable(this, {
            parts: observable,
        });

        this.leadin = leadin;
        this.parts = parts;
    }
}
