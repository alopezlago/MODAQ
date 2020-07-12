import { computed, observable, action } from "mobx";

import { PacketState, Bonus, Tossup } from "./PacketState";
import { Player } from "./TeamState";
import { Cycle, ICycle } from "./Cycle";
import { format } from "mobx-sync";

export class GameState {
    @observable
    public packet: PacketState;

    @observable
    public players: Player[];

    // Anything with methods/computeds not at the top level needs to use @format to deserialize correctly
    @observable
    @format((deserializedArray: ICycle[]) => {
        return deserializedArray.map((deserializedCycle) => {
            return new Cycle(deserializedCycle);
        });
    })
    public cycles: Cycle[];

    constructor() {
        this.packet = new PacketState();
        this.players = [];
        this.cycles = [];
    }

    @computed({ requiresReaction: true })
    public get isLoaded(): boolean {
        return this.packet.tossups.length > 0;
    }

    @computed({ requiresReaction: true })
    public get teamNames(): string[] {
        const teamSet: Set<string> = new Set<string>(this.players.map((player) => player.teamName));

        const teamNames: string[] = [];
        for (const teamName of teamSet.values()) {
            teamNames.push(teamName);
        }

        teamNames.sort();
        return teamNames;
    }

    // If this is too expensive, investigate keepAlive
    // @computed({ keepAlive: true })
    @computed({ requiresReaction: true })
    public get score(): [number, number] {
        // More complex with powers. Need to convert buzzes to points, then add bonuses.
        // Would want getScore(team) method to simplify it

        const score: [number, number] = this.cycles.reduce(
            (previousScore, cycle) => {
                const scoreChange: [number, number] = this.getScoreChangeFromCycle(cycle);
                previousScore[0] += scoreChange[0];
                previousScore[1] += scoreChange[1];
                return previousScore;
            },
            [0, 0]
        );

        return score;
        // return this.teams().map(team => this.packet.tossups)
    }

    // TODO: Update this to support powers, and take into account format rules (powers/super-powers, etc.)
    public getScoreChangeFromCycle(cycle: Cycle): [number, number] {
        const change: [number, number] = [0, 0];
        if (cycle.correctBuzz) {
            const indexToUpdate: number = this.teamNames.indexOf(cycle.correctBuzz.marker.player.teamName);
            if (indexToUpdate < 0) {
                throw new Error(
                    `Correct buzz belongs to a non-existent team ${cycle.correctBuzz.marker.player.teamName}`
                );
            }

            change[indexToUpdate] += 10;
            if (cycle.bonusAnswer) {
                // TODO: We need the bonus value here, so we can get the part's value
                // // for (let partIndex in cycle.bonusAnswer.correctParts) {
                // //     change[indexToUpdate] += cycle.bonusAnswer.
                // // }
                change[indexToUpdate] += cycle.bonusAnswer.correctParts.reduce(
                    (previous, current) => previous + current.points,
                    0
                );
            }
        }

        if (cycle.negBuzz) {
            const indexToUpdate: number = this.teamNames.indexOf(cycle.negBuzz.marker.player.teamName);
            if (indexToUpdate < 0) {
                throw new Error(`Correct buzz belongs to a non-existent team ${cycle.negBuzz.marker.player.teamName}`);
            }

            change[indexToUpdate] -= 5;
        }

        return change;
    }

    @action
    public addPlayers(players: Player[]): void {
        this.players.push(...players);
    }

    @action
    public addPlayersForDemo(teamName: string, ...names: string[]): void {
        this.players.push(...names.map((name) => new Player(name, teamName, /* isStarter */ true)));
    }

    @action
    public clear(): void {
        this.packet = new PacketState();
        this.players = [];
        this.cycles = [];
    }

    public getPlayers(teamName: string): Player[] {
        return this.players.filter((player) => player.teamName === teamName);
    }

    public getBonus(cycleIndex: number): Bonus | undefined {
        return this.packet.bonsues[this.getBonusIndex(cycleIndex)];
    }

    // TODO: Add test where the previous correct buzz had a thrown out tossup
    public getBonusIndex(cycleIndex: number): number {
        const previousCycleIndex: number = cycleIndex - 1;
        const usedBonusesCount = this.cycles.reduce<number>((usedBonuses, value, currentIndex) => {
            // The bonus index should depend on how many bonus answers came before it, plus all of the thrown out bonuses
            if (currentIndex > cycleIndex) {
                return usedBonuses;
            }

            let bonusesRead = 0;
            if (value.correctBuzz != undefined && currentIndex <= previousCycleIndex) {
                bonusesRead++;
            }

            if (value.thrownOutBonuses != undefined) {
                bonusesRead += value.thrownOutBonuses.length;
            }

            return usedBonuses + bonusesRead;
        }, 0);

        return usedBonusesCount >= this.packet.bonsues.length ? -1 : usedBonusesCount;
    }

    public getTossup(cycleIndex: number): Tossup | undefined {
        return this.packet.tossups[this.getTossupIndex(cycleIndex)];
    }

    public getTossupIndex(cycleIndex: number): number {
        const thrownOutTossupsCount = this.cycles.reduce<number>((usedTossups, value, currentIndex) => {
            if (value.thrownOutTossups == undefined || currentIndex > cycleIndex) {
                return usedTossups;
            }

            return usedTossups + value.thrownOutTossups.length;
        }, 0);

        return cycleIndex + thrownOutTossupsCount;
    }

    @action
    public loadPacket(packet: PacketState): void {
        this.packet = packet;

        if (this.cycles.length < this.packet.tossups.length) {
            // TODO: Don't create cycles for tiebreaker rounds once we create packet formats to specify limits
            for (let i = this.cycles.length; i < this.packet.tossups.length; i++) {
                this.cycles.push(new Cycle());
            }
        }
    }
}
