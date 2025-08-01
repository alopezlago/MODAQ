import { computed, observable, action, makeObservable, when } from "mobx";
import { format } from "mobx-sync";

import * as GameFormats from "./GameFormats";
import * as PlayerUtils from "./PlayerUtils";
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

    @format((deserializedArray: IPlayer[]) => deserializedArray.map((p) => new Player(p.name, p.teamName, p.isStarter)))
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

    @format((deserializedDate: string) => new Date(deserializedDate))
    public lastUpdate: Date | undefined;

    constructor() {
        makeObservable(this, {
            cycles: observable,
            teamNames: computed,
            gameFormat: observable,
            hasUpdates: observable,
            lastUpdate: observable,
            markUpdateComplete: action,
            packet: observable,
            players: observable,
            isLoaded: computed,
            finalScore: computed,
            playableCycles: computed,
            scores: computed,
            addInactivePlayer: action,
            addNewPlayer: action,
            addNewPlayers: action,
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

    public get finalScore(): number[] {
        return this.scores[this.playableCycles.length - 1];
    }

    public get playableCycles(): Cycle[] {
        if (this.cycles.length <= this.gameFormat.regulationTossupCount) {
            return this.cycles;
        }

        // Check if the game is tied at the end of regulation and at the end of each overtime period. If it isn't,
        // return those cycles.
        const score: number[][] = this.scores;
        for (
            let i = this.gameFormat.regulationTossupCount - 1;
            i < this.cycles.length;
            i += this.gameFormat.minimumOvertimeQuestionCount
        ) {
            const scoreAtInterval: number[] = score[i];
            let isTied = false;
            let maxScore = -Infinity;
            for (const teamScore of scoreAtInterval) {
                if (teamScore > maxScore) {
                    maxScore = teamScore;
                    isTied = false;
                } else if (teamScore === maxScore) {
                    isTied = true;
                }
            }

            if (!isTied) {
                return this.cycles.slice(0, i + 1);
            }
        }

        return this.cycles;
    }

    public get scores(): number[][] {
        const score: number[][] = [];
        const previousScores: number[] = Array.from(this.teamNames, () => 0);

        // We should keep calculating until we're at the end of regulation or there are more tiebreaker questions
        // needed
        for (const cycle of this.cycles) {
            const scoreChange: number[] = this.getScoreChangeFromCycle(cycle);
            for (let i = 0; i < scoreChange.length; i++) {
                previousScores[i] += scoreChange[i];
            }

            score.push([...previousScores]);
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
                        let tossupTeamIndex: number = tossupProtest.teamName === this.teamNames[0] ? 0 : 1;
                        if (cycle.correctBuzz) {
                            // If the correct buzz is for the protesting team, then this should be for "against"
                            if (
                                cycle.correctBuzz.tossupIndex === tossupProtest.questionIndex &&
                                cycle.correctBuzz.marker.player.teamName === tossupProtest.teamName
                            ) {
                                tossupTeamIndex = 1 - tossupTeamIndex;
                            }

                            // We have a correct buzz... we need to discount this buzz for the other team, plus any
                            // bonus they got
                            const correctTossupPoints = tossup.getPointsAtPosition(
                                this.gameFormat,
                                tossupProtest.position,
                                /* isCorrect */ true
                            );

                            // Need to include correct parts and bouncebacks (the -1 * current.points part)
                            const bonusPoints =
                                cycle.bonusAnswer?.parts.reduce(
                                    (previous, current) =>
                                        (cycle.correctBuzz?.marker.player.teamName === current.teamName
                                            ? current.points
                                            : -1 * current.points) + previous,
                                    0
                                ) ?? 0;

                            swings[1 - tossupTeamIndex].against += correctTossupPoints + bonusPoints;
                        }

                        const bonusIndex: number = this.getBonusIndex(i);
                        const potentialBonusPoints =
                            this.packet.bonuses[bonusIndex]?.parts.reduce(
                                (previous, current) => current.value + previous,
                                0
                            ) ?? 0;

                        // Need to remove the neg (subtract) and add what the correct value would be
                        swings[tossupTeamIndex].for +=
                            tossup.getPointsAtPosition(this.gameFormat, tossupProtest.position, /* isCorrect */ true) -
                            tossup.getPointsAtPosition(this.gameFormat, tossupProtest.position, /* isCorrect */ false) +
                            potentialBonusPoints;
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
                }
            }
        }

        // [Best outcome for team 1, best outcome for team 2]
        return [
            [this.finalScore[0] + swings[0].for, this.finalScore[1] - swings[1].against],
            [this.finalScore[0] - swings[0].against, this.finalScore[1] + swings[1].for],
        ];
    }

    private static updateTeamNameIfNeeded(object: { teamName: string }, oldName: string, newName: string): void {
        if (object.teamName === oldName) {
            object.teamName = newName;
        }
    }

    public addInactivePlayer(player: Player, cycleIndex: number): void {
        for (let i = cycleIndex; i >= 0; i--) {
            const cycle: Cycle = this.cycles[i];

            if (
                cycle.playerJoins &&
                cycle.playerJoins.some((joinEvent) => PlayerUtils.playersEqual(player, joinEvent.inPlayer))
            ) {
                // We have a current or earlier join event with no leave events. Adding a player now is a no-op.
                return;
            }

            if (cycle.subs) {
                if (cycle.subs.some((subEvent) => PlayerUtils.playersEqual(player, subEvent.inPlayer))) {
                    // We have a current or earlier join event with no leave events. Adding a player now is a no-op.
                    return;
                } else if (cycle.subs.some((subEvent) => PlayerUtils.playersEqual(player, subEvent.outPlayer))) {
                    // Need to test subbing someone out and also having them join. Very strange set of events.
                    break;
                }
            }

            if (
                cycle.playerLeaves &&
                cycle.playerLeaves.some((leaveEvent) => PlayerUtils.playersEqual(player, leaveEvent.outPlayer))
            ) {
                // If it's the same cycle as the current one, remove the playerLeaves event, since this has priority
                // as we're explicitly adding it afterwards
                if (i == cycleIndex) {
                    const leaveEvent: IPlayerLeavesEvent | undefined = cycle.playerLeaves.find((leaveEvent) =>
                        PlayerUtils.playersEqual(player, leaveEvent.outPlayer)
                    );

                    if (leaveEvent != undefined) {
                        cycle.removePlayerLeaves(leaveEvent);
                    }
                }

                break;
            }
        }

        for (let i = cycleIndex + 1; i < this.cycles.length; i++) {
            const cycle: Cycle = this.cycles[i];

            if (
                cycle.playerLeaves &&
                cycle.playerLeaves.some((leaveEvent) => PlayerUtils.playersEqual(player, leaveEvent.outPlayer))
            ) {
                break;
            } else if (
                cycle.subs &&
                cycle.subs.some((subEvent) => PlayerUtils.playersEqual(player, subEvent.outPlayer))
            ) {
                break;
            }

            if (cycle.subs) {
                if (cycle.subs.some((subEvent) => PlayerUtils.playersEqual(player, subEvent.inPlayer))) {
                    // We're adding the player earlier, and there's no leave event. Remove that event and then add the new
                    // one
                    const subEvent: IPlayerJoinsEvent | undefined = cycle.subs.find(
                        (joinEvent) => !PlayerUtils.playersEqual(player, joinEvent.inPlayer)
                    );
                    if (subEvent) {
                        cycle.removePlayerJoins(subEvent);
                    }

                    break;
                } else if (cycle.subs.some((subEvent) => PlayerUtils.playersEqual(player, subEvent.outPlayer))) {
                    break;
                }
            }

            if (
                cycle.playerJoins &&
                cycle.playerJoins.some((joinEvent) => PlayerUtils.playersEqual(player, joinEvent.inPlayer))
            ) {
                // We're adding the player earlier, and there's no leave event. Remove that event and then add the new
                // one
                const joinEvent: IPlayerJoinsEvent | undefined = cycle.playerJoins.find((joinEvent) =>
                    PlayerUtils.playersEqual(player, joinEvent.inPlayer)
                );
                if (joinEvent) {
                    cycle.removePlayerJoins(joinEvent);
                }

                break;
            }
        }

        this.cycles[cycleIndex].addPlayerJoins(player);
    }

    public addNewPlayer(player: Player): void {
        this.players.push(player);
    }

    public addNewPlayers(players: Player[]): void {
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
        const activePlayers: Player[] = players.filter((player) => player.isStarter);

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
                const outPlayerIndex: number = activePlayers.findIndex(
                    (player) => player.name === leave.outPlayer.name
                );
                if (outPlayerIndex === -1) {
                    throw new Error(
                        `Tried to take out ${leave.outPlayer.name} from the game, who isn't on team ${teamName}`
                    );
                }

                activePlayers.splice(outPlayerIndex, 1);
            }

            const teamJoins: IPlayerJoinsEvent[] = joins?.filter((join) => join.inPlayer.teamName === teamName) ?? [];
            for (const join of teamJoins) {
                const inPlayer: Player | undefined = players.find((player) => player.name === join.inPlayer.name);
                if (inPlayer == undefined) {
                    throw new Error(`Tried to add ${join.inPlayer.name}, who isn't on team ${teamName}`);
                }

                activePlayers.push(inPlayer);
            }

            const teamSubs: ISubstitutionEvent[] = subs?.filter((sub) => sub.inPlayer.teamName === teamName) ?? [];
            for (const sub of teamSubs) {
                const inPlayer: Player | undefined = players.find((player) => player.name === sub.inPlayer.name);
                const outPlayerIndex: number = activePlayers.findIndex((player) => player.name === sub.outPlayer.name);

                if (inPlayer == undefined) {
                    throw new Error(
                        `Tried to substitute in player ${sub.inPlayer.name}, who isn't on team ${teamName}`
                    );
                } else if (outPlayerIndex === -1) {
                    throw new Error(
                        `Tried to substitute out player ${sub.outPlayer.name}, who isn't on team ${teamName}`
                    );
                }

                activePlayers[outPlayerIndex] = inPlayer;
            }
        }

        // Adding and removing players switches the order, but we want to obey the player order people have

        return new Set<Player>(activePlayers);
    }

    // TODO: Make this return a set?
    public getPlayers(teamName: string): Player[] {
        return this.players.filter((player) => player.teamName === teamName);
    }

    public getBonus(cycleIndex: number): Bonus | undefined {
        return this.packet.bonuses[this.getBonusIndex(cycleIndex)];
    }

    public getBonusIndex(cycleIndex: number): number {
        if (this.gameFormat.pairTossupsBonuses) {
            // Same as the cycle index plus thrown out questions
            let thrownOutBonusesCount = 0;
            for (let i = 0; i <= cycleIndex; i++) {
                const cycle: Cycle = this.cycles[i];
                if (cycle.thrownOutBonuses !== undefined) {
                    thrownOutBonusesCount += cycle.thrownOutBonuses.length;
                }
            }

            const index = cycleIndex + thrownOutBonusesCount;
            return index >= this.packet.bonuses.length ? -1 : index;
        }

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
        this.lastUpdate = new Date(Date.now());
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

        this.markUpdateNeeded();
    }

    public setCycles(cycles: Cycle[]): void {
        this.cycles = cycles;
    }

    public setGameFormat(gameFormat: IGameFormat): void {
        this.gameFormat = gameFormat;
        this.markUpdateNeeded();
    }

    public setPlayers(players: Player[]): void {
        this.players = players;
        this.markUpdateNeeded();
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

    public tryUpdateTeamName(oldTeamName: string, newTeamName: string): boolean {
        newTeamName = newTeamName.trim();
        if (newTeamName === "") {
            return false;
        }

        // If the names are the same, no update is needed
        if (oldTeamName === newTeamName) {
            return true;
        }

        // Need to make sure we won't have two teams that have the new name
        for (const teamName of this.teamNames) {
            if (teamName === newTeamName) {
                return false;
            }
        }

        // Update all player team names matching this
        for (const player of this.players) {
            if (player.teamName === oldTeamName) {
                player.setTeamName(newTeamName);
            }
        }

        // Update all cycles that use this team name. Follow the guidance from tryUpdatePlayerName
        // If we need this to be more performant, we should be able to get away with updating the name just once,
        // but we do it everywhere here in case we use a copy (.e.g. like {...player}). Mobx may block this sometimes
        for (const cycle of this.cycles) {
            if (cycle.correctBuzz != undefined) {
                GameState.updateTeamNameIfNeeded(cycle.correctBuzz.marker.player, oldTeamName, newTeamName);
            }

            if (cycle.wrongBuzzes != undefined) {
                for (const wrongBuzz of cycle.wrongBuzzes) {
                    GameState.updateTeamNameIfNeeded(wrongBuzz.marker.player, oldTeamName, newTeamName);
                }
            }

            if (cycle.bonusAnswer != undefined) {
                if (cycle.bonusAnswer.receivingTeamName === oldTeamName) {
                    cycle.bonusAnswer.receivingTeamName = newTeamName;
                }

                if (cycle.bonusAnswer.parts != undefined) {
                    for (const part of cycle.bonusAnswer.parts) {
                        GameState.updateTeamNameIfNeeded(part, oldTeamName, newTeamName);
                    }
                }
            }

            if (cycle.timeouts) {
                for (const timeout of cycle.timeouts) {
                    GameState.updateTeamNameIfNeeded(timeout, oldTeamName, newTeamName);
                }
            }

            if (cycle.playerJoins != undefined) {
                for (const join of cycle.playerJoins) {
                    GameState.updateTeamNameIfNeeded(join.inPlayer, oldTeamName, newTeamName);
                }
            }

            if (cycle.playerLeaves != undefined) {
                for (const leave of cycle.playerLeaves) {
                    GameState.updateTeamNameIfNeeded(leave.outPlayer, oldTeamName, newTeamName);
                }
            }

            if (cycle.subs != undefined) {
                // Could be in or out player
                for (const sub of cycle.subs) {
                    GameState.updateTeamNameIfNeeded(sub.inPlayer, oldTeamName, newTeamName);
                    GameState.updateTeamNameIfNeeded(sub.outPlayer, oldTeamName, newTeamName);
                }
            }

            if (cycle.tossupProtests != undefined) {
                for (const protest of cycle.tossupProtests) {
                    GameState.updateTeamNameIfNeeded(protest, oldTeamName, newTeamName);
                }
            }

            if (cycle.bonusProtests != undefined) {
                for (const protest of cycle.bonusProtests) {
                    GameState.updateTeamNameIfNeeded(protest, oldTeamName, newTeamName);
                }
            }
        }

        return true;
    }

    private getScoreChangeFromCycle(cycle: Cycle): number[] {
        const change: number[] = Array.from(this.teamNames, () => 0);
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
