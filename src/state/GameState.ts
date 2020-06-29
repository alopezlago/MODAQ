import { computed, observable, action } from "mobx";

import * as CompareUtils from "./CompareUtils";
import { PacketState } from "./PacketState";
import { Team, Player, IPlayer } from "./TeamState";
import { Cycle, ICycle } from "./Cycle";
import { format } from "mobx-sync";

export class GameState {
    @observable
    public packet: PacketState;

    @observable
    public firstTeam: Team;

    @observable
    public secondTeam: Team;

    @observable
    @format((deserializedArray: IPlayer[]) => {
        return deserializedArray.map((deserializedPlayer) => {
            return new Player(deserializedPlayer.name, new Team(deserializedPlayer.team.name));
        });
    })
    public players: Player[];

    // Anything with methods/computeds needs to use @format to deserialize correctly
    @observable
    @format((deserializedArray: ICycle[]) => {
        return deserializedArray.map((deserializedCycle) => {
            return new Cycle(deserializedCycle);
        });
    })
    public cycles: Cycle[];

    constructor() {
        this.packet = new PacketState();

        this.firstTeam = new Team();
        this.secondTeam = new Team();
        this.players = [];

        this.cycles = [];
    }

    @computed
    public get isLoaded(): boolean {
        return this.packet.tossups.length > 0;
    }

    @computed
    public get teams(): Team[] {
        return [this.firstTeam, this.secondTeam];
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
            const indexToUpdate: number = CompareUtils.teamsEqual(cycle.correctBuzz.marker.player.team, this.firstTeam)
                ? 0
                : 1;
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
            const indexToUpdate: number = CompareUtils.teamsEqual(cycle.negBuzz.marker.player.team, this.firstTeam)
                ? 0
                : 1;
            change[indexToUpdate] -= 5;
        }

        return change;
    }

    @action
    public addPlayers(team: Team, ...names: string[]): void {
        this.players.push(...names.map((name) => new Player(name, team)));
    }

    public getPlayers(team: Team): Player[] {
        return this.players.filter((player) => CompareUtils.teamsEqual(player.team, team));
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
