import { computed, observable, action, makeObservable } from "mobx";
import { format } from "mobx-sync";

import * as GameFormats from "./GameFormats";
import { PacketState, Bonus, Tossup } from "./PacketState";
import { Player } from "./TeamState";
import { Cycle, ICycle } from "./Cycle";
import { ISubstitutionEvent, IPlayerJoinsEvent, IPlayerLeavesEvent, IBonusAnswerPart } from "./Events";
import { IGameFormat } from "./IGameFormat";

export class GameState {
    public packet: PacketState;

    public players: Player[];

    // In general we should prefer playableCycles, but if it's used for updating cycles directly, then
    // using cycles can be safer since we're less likely to have an issue with the index being out of bounds
    // Anything with methods/computeds not at the top level needs to use @format to deserialize correctly
    @format((deserializedArray: ICycle[]) => {
        return deserializedArray.map((deserializedCycle) => {
            return new Cycle(deserializedCycle);
        });
    })
    public cycles: Cycle[];

    @format((deserializedFormat: IGameFormat) => GameFormats.getUpgradedFormatVersion(deserializedFormat))
    public gameFormat: IGameFormat;

    constructor() {
        makeObservable(this, {
            cycles: observable,
            teamNames: computed,
            gameFormat: observable,
            packet: observable,
            players: observable,
            isLoaded: computed,
            finalScore: computed,
            playableCycles: computed,
            scores: computed,
            addPlayer: action,
            addPlayers: action,
            clear: action,
            loadPacket: action,
            setCycles: action,
            setGameFormat: action,
        });

        this.packet = new PacketState();
        this.players = [];
        this.cycles = [];
        this.gameFormat = GameFormats.UndefinedGameFormat;
    }

    public get isLoaded(): boolean {
        return this.packet.tossups.length > 0;
    }

    public get teamNames(): string[] {
        const teamSet: Set<string> = new Set<string>(this.players.map((player) => player.teamName));

        const teamNames: string[] = [];
        for (const teamName of teamSet.values()) {
            teamNames.push(teamName);
        }

        teamNames.sort();
        return teamNames;
    }

    public get finalScore(): [number, number] {
        return this.scores[this.playableCycles.length - 1];
    }

    public get playableCycles(): Cycle[] {
        if (this.cycles.length <= this.gameFormat.regulationTossupCount) {
            return this.cycles;
        }

        // Check if the game is tied at the end of regulation and at the end of each overtime period. If it isn't,
        // return those cycles.
        const score: [number, number][] = this.scores;
        for (
            let i = this.gameFormat.regulationTossupCount - 1;
            i < this.cycles.length;
            i += this.gameFormat.minimumOvertimeQuestionCount
        ) {
            const scoreAtInterval: [number, number] = score[i];
            if (scoreAtInterval[0] !== scoreAtInterval[1]) {
                return this.cycles.slice(0, i + 1);
            }
        }

        return this.cycles;
    }

    public get scores(): [number, number][] {
        const score: [number, number][] = [];
        let firstTeamPreviousScore = 0;
        let secondTeamPreviousScore = 0;

        // We should keep calculating until we're at the end of regulation or there are more tiebreaker questions
        // needed
        for (const cycle of this.cycles) {
            const scoreChange: [number, number] = this.getScoreChangeFromCycle(cycle);
            firstTeamPreviousScore += scoreChange[0];
            secondTeamPreviousScore += scoreChange[1];
            score.push([firstTeamPreviousScore, secondTeamPreviousScore]);
        }

        return score;
    }

    public addPlayer(player: Player): void {
        this.players.push(player);
    }

    public addPlayers(players: Player[]): void {
        this.players.push(...players);
    }

    public clear(): void {
        this.packet = new PacketState();
        this.players = [];
        this.cycles = [];
    }

    public getActivePlayers(teamName: string, cycleIndex: number): Set<Player> {
        // If there's no cycles at that index, then there are no active players
        if (cycleIndex >= this.cycles.length) {
            return new Set<Player>();
        }

        const players: Player[] = this.getPlayers(teamName);
        const activePlayers: Set<Player> = new Set<Player>(players.filter((player) => player.isStarter));

        // We should just have starters at the beginning. Then swap out new players, based on substitutions up to the
        // cycleIndex.
        for (let i = 0; i <= cycleIndex; i++) {
            const cycle: Cycle = this.cycles[i];
            const subs: ISubstitutionEvent[] | undefined = cycle.subs;
            const joins: IPlayerJoinsEvent[] | undefined = cycle.playerJoins;
            const leaves: IPlayerLeavesEvent[] | undefined = cycle.playerLeaves;

            if (subs == undefined && joins == undefined && leaves == undefined) {
                continue;
            }

            const teamLeaves: IPlayerLeavesEvent[] =
                leaves?.filter((leave) => leave.outPlayer.teamName === teamName) ?? [];
            for (const leave of teamLeaves) {
                const outPlayer: Player | undefined = players.find((player) => player.name === leave.outPlayer.name);
                if (outPlayer == undefined) {
                    throw new Error(
                        `Tried to take out ${leave.outPlayer.name} from the game, who isn't on team ${teamName}`
                    );
                }

                activePlayers.delete(outPlayer);
            }

            const teamJoins: IPlayerJoinsEvent[] = joins?.filter((join) => join.inPlayer.teamName === teamName) ?? [];
            for (const join of teamJoins) {
                const inPlayer: Player | undefined = players.find((player) => player.name === join.inPlayer.name);
                if (inPlayer == undefined) {
                    throw new Error(`Tried to add ${join.inPlayer.name}, who isn't on team ${teamName}`);
                }

                activePlayers.add(inPlayer);
            }

            const teamSubs: ISubstitutionEvent[] = subs?.filter((sub) => sub.inPlayer.teamName === teamName) ?? [];
            for (const sub of teamSubs) {
                const inPlayer = players.find((player) => player.name === sub.inPlayer.name);
                const outPlayer = players.find((player) => player.name === sub.outPlayer.name);

                if (inPlayer == undefined) {
                    throw new Error(
                        `Tried to substitute in player ${sub.inPlayer.name}, who isn't on team ${teamName}`
                    );
                } else if (outPlayer == undefined) {
                    throw new Error(
                        `Tried to substitute out player ${sub.outPlayer.name}, who isn't on team ${teamName}`
                    );
                }

                activePlayers.add(inPlayer);
                activePlayers.delete(outPlayer);
            }
        }

        return activePlayers;
    }

    // TODO: Make this return a set?
    public getPlayers(teamName: string): Player[] {
        return this.players.filter((player) => player.teamName === teamName);
    }

    public getBonus(cycleIndex: number): Bonus | undefined {
        return this.packet.bonuses[this.getBonusIndex(cycleIndex)];
    }

    public getBonusIndex(cycleIndex: number): number {
        const previousCycleIndex: number = cycleIndex - 1;
        let usedBonusesCount = 0;
        for (let i = 0; i <= cycleIndex; i++) {
            const cycle = this.cycles[i];
            if (cycle.correctBuzz != undefined && i <= previousCycleIndex) {
                usedBonusesCount++;
            }

            if (cycle.thrownOutBonuses != undefined) {
                usedBonusesCount += cycle.thrownOutBonuses.length;
            }
        }

        return usedBonusesCount >= this.packet.bonuses.length ? -1 : usedBonusesCount;
    }

    public getTossup(cycleIndex: number): Tossup | undefined {
        return this.packet.tossups[this.getTossupIndex(cycleIndex)];
    }

    public getTossupIndex(cycleIndex: number): number {
        let thrownOutTossupsCount = 0;
        for (let i = 0; i <= cycleIndex; i++) {
            const cycle: Cycle = this.cycles[i];
            if (cycle.thrownOutTossups !== undefined) {
                thrownOutTossupsCount += cycle.thrownOutTossups.length;
            }
        }

        return cycleIndex + thrownOutTossupsCount;
    }

    public loadPacket(packet: PacketState): void {
        this.packet = packet;

        if (this.cycles.length < this.packet.tossups.length) {
            // TODO: Don't create cycles for tiebreaker rounds once we create packet formats to specify limits
            for (let i = this.cycles.length; i < this.packet.tossups.length; i++) {
                this.cycles.push(new Cycle());
            }
        }
    }

    public setCycles(cycles: Cycle[]): void {
        this.cycles = cycles;
    }

    public setGameFormat(gameFormat: IGameFormat): void {
        this.gameFormat = gameFormat;
    }

    private getScoreChangeFromCycle(cycle: Cycle): [number, number] {
        const change: [number, number] = [0, 0];
        if (cycle.correctBuzz) {
            const indexToUpdate: number = this.teamNames.indexOf(cycle.correctBuzz.marker.player.teamName);
            if (indexToUpdate < 0) {
                throw new Error(
                    `Correct buzz belongs to a non-existent team ${cycle.correctBuzz.marker.player.teamName}`
                );
            }

            // More complex with powers. Need to convert buzzes to points, then add bonuses.
            // Would want getScore(team) method to simplify it
            // If points isn't specified, this is an old game that relied on the correct flag. It only supported 10
            // points
            change[indexToUpdate] += cycle.correctBuzz.marker.points;
            if (cycle.bonusAnswer) {
                for (let i = 0; i < cycle.bonusAnswer.parts.length; i++) {
                    let bonusAnswerTeamIndex: number = indexToUpdate;
                    const part: IBonusAnswerPart = cycle.bonusAnswer.parts[i];
                    if (part.teamName === "") {
                        // No team scored this part, skip it
                        continue;
                    } else if (part.teamName !== cycle.correctBuzz.marker.player.teamName) {
                        bonusAnswerTeamIndex = this.teamNames.indexOf(part.teamName);
                        if (bonusAnswerTeamIndex === -1) {
                            // Bad part, skip this
                            continue;
                        }
                    }

                    change[bonusAnswerTeamIndex] += part.points;
                }
            }
        }

        if (cycle.wrongBuzzes != undefined && this.gameFormat.negValue !== 0) {
            for (const buzz of cycle.wrongBuzzes) {
                if (buzz.marker.points >= 0) {
                    continue;
                }

                const indexToUpdate: number = this.teamNames.indexOf(buzz.marker.player.teamName);
                if (indexToUpdate < 0) {
                    throw new Error(`Correct buzz belongs to a non-existent team ${buzz.marker.player.teamName}`);
                }

                change[indexToUpdate] += buzz.marker.points ?? this.gameFormat.negValue;
            }
        }

        return change;
    }
}
