import { computed, observable, action, makeObservable, when } from "mobx";
import { format } from "mobx-sync";

import * as GameFormats from "./GameFormats";
import { PacketState, Bonus, Tossup } from "./PacketState";
import { IPlayer, Player } from "./TeamState";
import { Cycle, ICycle } from "./Cycle";
import {
    ISubstitutionEvent,
    IPlayerJoinsEvent,
    IPlayerLeavesEvent,
    IBonusAnswerPart,
    ITossupAnswerEvent,
} from "./Events";
import { IGameFormat } from "./IGameFormat";

export class GameState {
    public packet: PacketState;

    public players: Player[];

    // In general we should prefer playableCycles, but if it's used for updating cycles directly, then
    // using cycles can be safer since we're less likely to have an issue with the index being out of bounds
    // Anything with methods/computeds not at the top level needs to use @format to deserialize correctly
    @format((deserializedArray: ICycle[], currentCycles: Cycle[]) => {
        // This is sometimes called twice, and the second time the old value is the same as the new one. In that case,
        // just return the current value. This fixes an issue where the update handler on the cycle gets wiped out.
        if (deserializedArray === currentCycles) {
            return currentCycles;
        }

        return deserializedArray.map((deserializedCycle) => {
            return new Cycle(deserializedCycle);
        });
    })
    public cycles: Cycle[];

    @format((deserializedFormat: IGameFormat) => GameFormats.getUpgradedFormatVersion(deserializedFormat))
    public gameFormat: IGameFormat;

    public hasUpdates: boolean;

    constructor() {
        makeObservable(this, {
            cycles: observable,
            teamNames: computed,
            gameFormat: observable,
            hasUpdates: observable,
            markUpdateComplete: action,
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
            removeNewPlayer: action,
            setPlayers: action,
        });

        this.packet = new PacketState();
        this.players = [];
        this.cycles = [];
        this.gameFormat = GameFormats.UndefinedGameFormat;
        this.hasUpdates = false;

        // Once we've filled out all the cycles, then add the update handlers to all of the cycles. This is needed
        // because we can't do this when getting data from deserialized cycles (no access to this in the decorator)
        when(
            () => this.cycles.length >= this.gameFormat.regulationTossupCount,
            () => {
                for (const cycle of this.cycles) {
                    cycle.setUpdateHandler(() => this.markUpdateNeeded());
                }
            }
        );
    }

    public get isLoaded(): boolean {
        return this.packet.tossups.length > 0;
    }

    public get teamNames(): string[] {
        // There should be very few teams names (really two)
        if (this.players.length === 0) {
            return [];
        }

        const seenTeams: Set<string> = new Set<string>();

        const firstTeamName = this.players[0].teamName;
        seenTeams.add(firstTeamName);
        const teamNames = [firstTeamName];

        for (let i = 1; i < this.players.length; i++) {
            const teamName = this.players[i].teamName;
            if (!seenTeams.has(teamName)) {
                seenTeams.add(teamName);
                teamNames.push(teamName);
            }
        }

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

    public get protestsMatter(): boolean {
        if (this.finalScore == undefined || this.finalScore.length < 2) {
            return false;
        }

        if (this.finalScore[0] === this.finalScore[1]) {
            // If there are any protests, they matter.
            return this.cycles.some(
                (cycle) =>
                    (cycle.tossupProtests != undefined && cycle.tossupProtests.length > 0) ||
                    (cycle.bonusProtests != undefined && cycle.bonusProtests.length > 0)
            );
        }

        const leadingTeamIndex: number = this.finalScore[0] > this.finalScore[1] ? 0 : 1;
        const losingTeamIndex: number = leadingTeamIndex === -1 ? -1 : 1 - leadingTeamIndex;

        // Protests only matter if the losing team's protests would be enough to get them to tie
        return (
            this.protestSwings[losingTeamIndex][losingTeamIndex] >=
            this.protestSwings[losingTeamIndex][leadingTeamIndex]
        );
    }

    // Returns the best possible outcome for team 1, and the best possible outcome for team 2
    private get protestSwings(): [[number, number], [number, number]] {
        const swings: [IProtestSwing, IProtestSwing] = [
            { against: 0, for: 0 },
            { against: 0, for: 0 },
        ];

        for (let i = 0; i < this.cycles.length; i++) {
            const cycle: Cycle = this.cycles[i];

            if (cycle.tossupProtests) {
                for (const tossupProtest of cycle.tossupProtests) {
                    // Don't use getTossup because the protest could've been in a thrown-out tossup
                    const tossup: Tossup | undefined = this.packet.tossups[tossupProtest.questionIndex];

                    if (tossup != undefined) {
                        const tossupTeamIndex: number = tossupProtest.teamName === this.teamNames[0] ? 0 : 1;
                        // Need to remove the neg (subtract) and add what the correct value would be
                        swings[tossupTeamIndex].for +=
                            tossup.getPointsAtPosition(this.gameFormat, tossupProtest.position, /* isCorrect */ true) -
                            tossup.getPointsAtPosition(this.gameFormat, tossupProtest.position, /* isCorrect */ false);
                    }
                }
            }

            if (cycle.bonusProtests && cycle.correctBuzz) {
                const correctBuzzTeamName: string = cycle.correctBuzz.marker.player.teamName;

                for (const bonusProtest of cycle.bonusProtests) {
                    // Don't use getBonus because the protest could've been in a bonus that was then replaced
                    const bonus: Bonus | undefined = this.packet.bonuses[bonusProtest.questionIndex];
                    if (bonus != undefined) {
                        const bonusTeamIndex: number = correctBuzzTeamName === this.teamNames[0] ? 0 : 1;
                        const value: number = bonus.parts[bonusProtest.partIndex].value;
                        if (bonusProtest.teamName === correctBuzzTeamName) {
                            swings[bonusTeamIndex].for += value;
                        } else {
                            swings[bonusTeamIndex].against += value;
                        }
                    }
                    bonusProtest.partIndex;
                }
            }
        }

        return [
            [this.finalScore[0] + swings[0].for, this.finalScore[1] - swings[1].against],
            [this.finalScore[0] - swings[0].against, this.finalScore[1] + swings[1].for],
        ];
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

    public getBuzzValue(buzz: ITossupAnswerEvent): number {
        const tossup: Tossup | undefined = this.packet.tossups[buzz.tossupIndex];
        if (tossup == undefined) {
            return 0;
        }

        return tossup.getPointsAtPosition(
            this.gameFormat,
            buzz.marker.position,
            /* isCorrect */ buzz.marker.points > 0
        );
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
            const handler = () => this.markUpdateNeeded();
            for (let i = this.cycles.length; i < this.packet.tossups.length; i++) {
                const cycle: Cycle = new Cycle();
                cycle.setUpdateHandler(handler);
                this.cycles.push(cycle);
            }
        }
    }

    public markUpdateNeeded(): void {
        this.hasUpdates = true;
    }

    public markUpdateComplete(): void {
        this.hasUpdates = false;
    }

    public removeNewPlayer(player: IPlayer): void {
        const playersSize = this.players.length;
        this.players = this.players.filter((p) => p !== player);

        if (this.players.length === playersSize) {
            return;
        }

        // We have to go through future cycles and remove events where the player is mentioned. This should be handled
        // inside of the cycle.
        for (const cycle of this.cycles) {
            cycle.removeNewPlayerEvents(player);
        }

        this.hasUpdates = true;
    }

    public setCycles(cycles: Cycle[]): void {
        this.cycles = cycles;
    }

    public setGameFormat(gameFormat: IGameFormat): void {
        this.hasUpdates = true;
        this.gameFormat = gameFormat;
    }

    public setPlayers(players: Player[]): void {
        this.hasUpdates = true;
        this.players = players;
    }

    public tryUpdatePlayerName(playerTeam: string, oldPlayerName: string, newPlayerName: string): boolean {
        let player: IPlayer | undefined;
        for (const p of this.players) {
            if (p.teamName === playerTeam && p.name === oldPlayerName) {
                if (p.name === oldPlayerName) {
                    player = p;
                } else if (p.name === newPlayerName) {
                    // Can't update the player, since that name already exists
                    return false;
                }
            }
        }

        if (player == undefined) {
            return false;
        }

        player.name = newPlayerName;

        // Setting player.name to newPlayerName doesn't work if you're going off of a copy of the player
        // Go through and update all events manually.
        // If we need this to be more performant, we should be able to get away with updating the name just once,
        // but we do it everywhere here in case we use a copy (.e.g. like {...player})
        for (const cycle of this.cycles) {
            if (
                cycle.correctBuzz != undefined &&
                cycle.correctBuzz.marker.player.name === oldPlayerName &&
                cycle.correctBuzz.marker.player.teamName === playerTeam
            ) {
                cycle.correctBuzz.marker.player.name = newPlayerName;
            }

            if (cycle.wrongBuzzes != undefined) {
                for (const wrongBuzz of cycle.wrongBuzzes) {
                    if (
                        wrongBuzz.marker.player.name === oldPlayerName &&
                        wrongBuzz.marker.player.teamName === playerTeam
                    ) {
                        wrongBuzz.marker.player.name = newPlayerName;
                    }
                }
            }

            if (cycle.playerJoins != undefined) {
                for (const join of cycle.playerJoins) {
                    if (join.inPlayer.name === oldPlayerName && join.inPlayer.teamName === playerTeam) {
                        join.inPlayer.name = newPlayerName;
                    }
                }
            }

            if (cycle.playerLeaves != undefined) {
                for (const leave of cycle.playerLeaves) {
                    if (leave.outPlayer.name === oldPlayerName && leave.outPlayer.teamName === playerTeam) {
                        leave.outPlayer.name = newPlayerName;
                    }
                }
            }

            if (cycle.subs != undefined) {
                // Could be in or out player
                for (const sub of cycle.subs) {
                    if (sub.inPlayer.name === oldPlayerName && sub.inPlayer.teamName === playerTeam) {
                        sub.inPlayer.name = newPlayerName;
                    } else if (sub.outPlayer.name === oldPlayerName && sub.outPlayer.teamName === playerTeam) {
                        sub.outPlayer.name = newPlayerName;
                    }
                }
            }
        }

        return true;
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

            change[indexToUpdate] += this.getBuzzValue(cycle.correctBuzz);
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

        if (cycle.wrongBuzzes != undefined && cycle.wrongBuzzes.length > 0 && this.gameFormat.negValue !== 0) {
            const negBuzz: ITossupAnswerEvent | undefined = cycle.firstWrongBuzz;
            if (negBuzz == undefined) {
                throw new Error("Neg couldn't be found in list of non-empty incorrect buzzes");
            }

            const indexToUpdate: number = this.teamNames.indexOf(negBuzz.marker.player.teamName);
            if (indexToUpdate < 0) {
                throw new Error(`Wrong buzz belongs to a non-existent team ${negBuzz.marker.player.teamName}`);
            }

            change[indexToUpdate] += this.getBuzzValue(negBuzz);
        }

        return change;
    }
}

interface IProtestSwing {
    against: number;
    for: number;
}
