import { observable, action, computed, makeObservable } from "mobx";
import { format } from "mobx-sync";

import * as Events from "./Events";
import * as PlayerUtils from "./PlayerUtils";
import { IBuzzMarker } from "./IBuzzMarker";
import { IGameFormat } from "./IGameFormat";
import { IPlayer } from "./TeamState";

// TODO: Build a stack of cycle changes, so we can support undo. This might mean that mobx isn't the best store for it
// (not as simple to go back)

export class Cycle implements ICycle {
    @format(
        (persistedBuzz: Events.ITossupAnswerEvent & { correct: boolean }, currentBuzz: Events.ITossupAnswerEvent) => {
            // Old games would have a "correct" field instead of having points on the marker
            if (persistedBuzz.correct != undefined && persistedBuzz.marker.points == undefined) {
                currentBuzz.marker.points = 10;
            }

            return currentBuzz;
        }
    )
    correctBuzz?: Events.ITossupAnswerEvent;

    wrongBuzzes?: Events.ITossupAnswerEvent[];

    bonusAnswer?: Events.IBonusAnswerEvent;

    playerJoins?: Events.IPlayerJoinsEvent[];

    playerLeaves?: Events.IPlayerLeavesEvent[];

    subs?: Events.ISubstitutionEvent[];

    timeouts?: Events.ITimeoutEvent[];

    bonusProtests?: Events.IBonusProtestEvent[];

    tossupProtests?: Events.ITossupProtestEvent[];

    thrownOutTossups?: Events.IThrowOutQuestionEvent[];

    thrownOutBonuses?: Events.IThrowOutQuestionEvent[];

    onUpdate?: () => void;

    constructor(deserializedCycle?: ICycle) {
        // We don't use makeAutoObservable because there are methods like getProtestableBonusPartIndexes which aren't
        // actions
        makeObservable(this, {
            correctBuzz: observable,
            firstWrongBuzz: computed,
            wrongBuzzes: observable,
            bonusAnswer: observable,
            playerJoins: observable,
            playerLeaves: observable,
            subs: observable,
            timeouts: observable,
            bonusProtests: observable,
            tossupProtests: observable,
            thrownOutTossups: observable,
            thrownOutBonuses: observable,
            orderedBuzzes: computed,
            addCorrectBuzz: action,
            addWrongBuzz: action,
            addBonusProtest: action,
            addPlayerJoins: action,
            addPlayerLeaves: action,
            addSwapSubstitution: action,
            addThrownOutBonus: action,
            addThrownOutTossup: action,
            addTossupProtest: action,
            removeBonusProtest: action,
            removeCorrectBuzz: action,
            removePlayerJoins: action,
            removePlayerLeaves: action,
            removeSubstitution: action,
            removeThrownOutBonus: action,
            removeThrownOutTossup: action,
            removeTossupProtest: action,
            removeWrongBuzz: action,
            setBonusPartAnswer: action,
        });

        // Using autorun requries checking all the events and could be called multiple times, so just use this method
        // directly instead
        this.onUpdate = undefined;

        if (deserializedCycle) {
            this.bonusAnswer =
                deserializedCycle.bonusAnswer == undefined
                    ? undefined
                    : Cycle.formatBonusAnswer(deserializedCycle.bonusAnswer);
            this.bonusProtests = deserializedCycle.bonusProtests;
            this.correctBuzz = deserializedCycle.correctBuzz;
            this.wrongBuzzes = deserializedCycle.wrongBuzzes;
            this.playerJoins = deserializedCycle.playerJoins;
            this.playerLeaves = deserializedCycle.playerLeaves;
            this.subs = deserializedCycle.subs;
            this.timeouts = deserializedCycle.timeouts;
            this.thrownOutBonuses = deserializedCycle.thrownOutBonuses;
            this.thrownOutTossups = deserializedCycle.thrownOutTossups;
            this.tossupProtests = deserializedCycle.tossupProtests;

            // Back-compat, when we split wrong buzzes based on if they were negs or not
            if (deserializedCycle.noPenaltyBuzzes) {
                this.wrongBuzzes = (this.wrongBuzzes ?? []).concat(deserializedCycle.noPenaltyBuzzes);
            }

            if (deserializedCycle.negBuzz) {
                this.wrongBuzzes = (this.wrongBuzzes ?? []).concat(deserializedCycle.negBuzz);
            }
        }
    }

    public get firstWrongBuzz(): Events.ITossupAnswerEvent | undefined {
        if (this.wrongBuzzes == undefined || this.wrongBuzzes.length === 0) {
            return undefined;
        }

        const sortedWrongBuzzes: Events.ITossupAnswerEvent[] = [...this.wrongBuzzes].sort(
            (left, right) => left.marker.position - right.marker.position
        );

        let negBuzz: Events.ITossupAnswerEvent = sortedWrongBuzzes[0];
        if (
            sortedWrongBuzzes.length > 1 &&
            sortedWrongBuzzes[0].marker.position === sortedWrongBuzzes[1].marker.position
        ) {
            // The neg buzz should be the fist buzz, so find the first buzz in the list of wrong buzzes
            const firstNegBuzz: Events.ITossupAnswerEvent | undefined = this.wrongBuzzes.find(
                (event) => event.marker.position === negBuzz.marker.position
            );
            if (firstNegBuzz == undefined) {
                throw new Error("Neg couldn't be found in list of incorrect buzzes");
            }

            negBuzz = firstNegBuzz;
        }

        return negBuzz;
    }

    public get orderedBuzzes(): Events.ITossupAnswerEvent[] {
        // Sort by tossupIndex, then by position. Tie breaker: negs before no penalties, negs/no penalties before correct
        const buzzes: Events.ITossupAnswerEvent[] = this.wrongBuzzes ? [...this.wrongBuzzes] : [];

        // Prioritization should be
        // - Buzzes on earlier tossups
        // - Buzzes earlier in the tossup
        // - Incorrect buzzes before correct ones
        // - Negs before no penalty buzzes
        // If we decide to store the point value with the buzz, just compare the point values
        buzzes.sort((buzz, otherBuzz) => {
            // Points are inaccurate, so don't rely on them. Trust the original ordering to let us know when buzzes happened
            if (buzz.tossupIndex < otherBuzz.tossupIndex) {
                return -1;
            }

            return buzz.marker.position - otherBuzz.marker.position;
        });

        if (this.correctBuzz) {
            buzzes.push(this.correctBuzz);
        }

        return buzzes;
    }

    private static formatBonusAnswer(persistedBonusAnswer: Events.IBonusAnswerEvent) {
        // Old games only have correctParts. Try to guess how many parts it has (either the standard 3 or something
        // based on the highest index)

        // default to 3 or the the length an array would need to be to support the index, whichever is higher
        if (persistedBonusAnswer.parts == undefined) {
            persistedBonusAnswer.parts = new Array(
                Math.max(
                    3,
                    persistedBonusAnswer.correctParts.reduce((old, current) => Math.max(old, current.index), 0) + 1
                )
            );

            for (let i = 0; i < persistedBonusAnswer.parts.length; i++) {
                persistedBonusAnswer.parts[i] = { points: 0, teamName: "" };
            }

            for (const part of persistedBonusAnswer.correctParts) {
                const currentPart: Events.IBonusAnswerPart = persistedBonusAnswer.parts[part.index];
                currentPart.points = part.points;
                currentPart.teamName = persistedBonusAnswer.receivingTeamName;
            }
        }

        return persistedBonusAnswer;
    }

    public addCorrectBuzz(
        marker: IBuzzMarker,
        tossupIndex: number,
        gameFormat: IGameFormat,
        bonusIndex: number | undefined,
        partsCount: number | undefined
    ): void {
        // If the previous correct buzz was from the same team, then their bonus should still stand, so restore it when
        // we remove all of the previous buzzes and the events they would've caused
        const bonusAnswer: Events.IBonusAnswerEvent | undefined =
            this.correctBuzz?.marker.player.teamName === marker.player.teamName ? this.bonusAnswer : undefined;

        this.removeTeamsBuzzes(marker.player.teamName, tossupIndex);

        if (bonusAnswer) {
            this.bonusAnswer = bonusAnswer;
        }

        this.correctBuzz = {
            tossupIndex,
            marker,
        };

        // TODO: we need a method to set the bonus index (either passed in here or with a new method)
        // Alternatively, we can remove the tossupIndex/bonusIndex, and fill it in whenever we have to serialize this
        if (
            bonusIndex != undefined &&
            (this.bonusAnswer == undefined || marker.player.teamName !== this.bonusAnswer.receivingTeamName)
        ) {
            const parts: Events.IBonusAnswerPart[] = [];
            if (partsCount !== undefined) {
                for (let i = 0; i < partsCount; i++) {
                    parts.push({ teamName: "", points: 0 });
                }
            }

            this.bonusAnswer = {
                bonusIndex,
                correctParts: [],
                receivingTeamName: marker.player.teamName,
                parts,
            };
        }

        // We should also remove all buzzes after this one, since a correct buzz should be the last one.
        if (this.wrongBuzzes) {
            this.wrongBuzzes = this.wrongBuzzes.filter((buzz) => buzz.marker.position <= marker.position);
            this.updateNeg(gameFormat);
        }

        this.updateIfNeeded();
    }

    public addWrongBuzz(marker: IBuzzMarker, tossupIndex: number, gameFormat: IGameFormat): void {
        if (this.wrongBuzzes == undefined) {
            this.wrongBuzzes = [];
        }

        this.removeTeamsBuzzes(marker.player.teamName, tossupIndex);

        const event: Events.ITossupAnswerEvent = {
            marker,
            tossupIndex,
        };

        const buzzIndex: number = this.wrongBuzzes.findIndex((buzz) => buzz.marker.position > marker.position);
        if (buzzIndex === -1) {
            this.wrongBuzzes.push(event);
        } else {
            const laterBuzzes: Events.ITossupAnswerEvent[] = this.wrongBuzzes.splice(buzzIndex);
            this.wrongBuzzes.push(event);
            this.wrongBuzzes = this.wrongBuzzes.concat(laterBuzzes);

            this.updateNeg(gameFormat);
        }

        // Clear the correct buzz if it's before this one, since the correct buzz should be the last one
        if (this.correctBuzz && this.correctBuzz.marker.position < marker.position) {
            this.removeCorrectBuzz();
        }

        this.updateIfNeeded();
    }

    public addBonusProtest(
        questionIndex: number,
        partIndex: number,
        givenAnswer: string | undefined,
        reason: string,
        teamName: string
    ): void {
        if (this.correctBuzz == undefined) {
            // There's no correct buzz, so there's no one to protest the bonus
            return;
        }

        if (this.bonusProtests == undefined) {
            this.bonusProtests = [];
        }

        // TODO: Investigate if we can get the questionIndex from the bonusAnswer event
        this.bonusProtests.push({
            givenAnswer,
            reason,
            partIndex,
            questionIndex,
            teamName,
        });

        this.updateIfNeeded();
    }

    public addPlayerJoins(inPlayer: IPlayer): void {
        if (this.playerJoins == undefined) {
            this.playerJoins = [];
        }

        this.playerJoins.push({
            inPlayer,
        });

        this.updateIfNeeded();
    }

    public addPlayerLeaves(outPlayer: IPlayer): void {
        // If the player just joined this cycle, remove them from the list of added players and remove their buzzes.
        // There's no need to keep them in both lists.
        if (this.playerJoins != undefined) {
            const joinEvent: Events.IPlayerJoinsEvent | undefined = this.playerJoins.find((event) =>
                PlayerUtils.playersEqual(event.inPlayer, outPlayer)
            );
            if (joinEvent) {
                this.playerJoins = this.playerJoins.filter((event) => event !== joinEvent);
                this.removePlayerBuzzes(outPlayer);
                return;
            }
        }

        if (this.playerLeaves == undefined) {
            this.playerLeaves = [];
        }

        this.playerLeaves.push({
            outPlayer,
        });

        this.removePlayerBuzzes(outPlayer);

        this.updateIfNeeded();
    }

    public addSwapSubstitution(inPlayer: IPlayer, outPlayer: IPlayer): void {
        if (this.subs == undefined) {
            this.subs = [];
        }

        this.subs.push({
            inPlayer,
            outPlayer,
        });

        this.removePlayerBuzzes(outPlayer);

        this.updateIfNeeded();
    }

    public addThrownOutBonus(bonusIndex: number): void {
        if (this.thrownOutBonuses == undefined) {
            this.thrownOutBonuses = [];
        }

        this.thrownOutBonuses.push({
            questionIndex: bonusIndex,
        });

        // Clear the bonus answer event
        if (this.bonusAnswer != undefined) {
            this.resetBonusAnswer();
            this.bonusAnswer.bonusIndex = bonusIndex + 1;
        }

        this.updateIfNeeded();
    }

    public addThrownOutTossup(tossupIndex: number): void {
        if (this.thrownOutTossups == undefined) {
            this.thrownOutTossups = [];
        }

        this.thrownOutTossups.push({
            questionIndex: tossupIndex,
        });

        // If we threw out the tossup, then we can't have a correct buzz; otherwise the tossup would've been allowed to
        // stay. Clear the correct buzz
        this.removeCorrectBuzz();

        this.updateIfNeeded();
    }

    public addTossupProtest(
        teamName: string,
        questionIndex: number,
        position: number,
        givenAnswer: string | undefined,
        reason: string
    ): void {
        if (this.tossupProtests == undefined) {
            this.tossupProtests = [];
        }

        this.tossupProtests.push({
            givenAnswer,
            reason,
            position,
            questionIndex,
            teamName,
        });

        this.updateIfNeeded();
    }

    // TODO: Try to make this a computed function
    public getProtestableBonusPartIndexes(bonusPartsCount: number): number[] {
        const indexes: number[] = [];

        const protestedIndexes: number[] = this.bonusProtests?.map((protest) => protest.partIndex) ?? [];
        const protestedIndexesSet = new Set(protestedIndexes);

        for (let i = 0; i < bonusPartsCount; i++) {
            if (!protestedIndexesSet.has(i)) {
                indexes.push(i);
            }
        }

        return indexes;
    }

    public removeBonusProtest(partIndex: number): void {
        if (this.bonusProtests == undefined) {
            return;
        }

        this.bonusProtests = this.bonusProtests.filter((protest) => protest.partIndex !== partIndex);
        if (this.bonusProtests.length === 0) {
            this.bonusProtests = undefined;
        }

        this.updateIfNeeded();
    }

    public removeCorrectBuzz(): void {
        this.correctBuzz = undefined;
        this.bonusAnswer = undefined;
        this.bonusProtests = undefined;

        this.updateIfNeeded();
    }

    public removeNewPlayerEvents(removedPlayer: IPlayer): void {
        if (this.playerJoins) {
            // Remove their joins
            let playerJoinsToRemove: Events.IPlayerJoinsEvent | undefined;
            for (const playerJoins of this.playerJoins) {
                if (playerJoins.inPlayer === removedPlayer) {
                    playerJoinsToRemove = playerJoins;
                    break;
                }
            }

            if (playerJoinsToRemove) {
                this.removePlayerJoins(playerJoinsToRemove);
            }
        }

        if (this.playerLeaves) {
            // Remove their leaves (no longer leaves, since they were never added)
            let playerLeavesToRemove: Events.IPlayerLeavesEvent | undefined;
            for (const playerLeaves of this.playerLeaves) {
                if (playerLeaves.outPlayer === removedPlayer) {
                    playerLeavesToRemove = playerLeaves;
                    break;
                }
            }

            if (playerLeavesToRemove) {
                this.removePlayerLeaves(playerLeavesToRemove);
            }
        }

        if (this.subs) {
            // Remove their substitutions
            let subToRemove: Events.ISubstitutionEvent | undefined;
            for (const sub of this.subs) {
                if (sub.inPlayer === removedPlayer || sub.outPlayer === removedPlayer) {
                    subToRemove = sub;
                    break;
                }
            }

            if (subToRemove) {
                this.removeSubstitution(subToRemove);
            }
        }

        this.removePlayerBuzzes(removedPlayer);

        this.updateIfNeeded();
    }

    public removePlayerJoins(joinToRemove: Events.IPlayerJoinsEvent): void {
        if (this.playerJoins == undefined) {
            return;
        }

        this.playerJoins = this.playerJoins.filter((join) => join !== joinToRemove);

        this.updateIfNeeded();
    }

    public removePlayerLeaves(leaveToRemove: Events.IPlayerLeavesEvent): void {
        if (this.playerLeaves == undefined) {
            return;
        }

        this.playerLeaves = this.playerLeaves.filter((leave) => leave !== leaveToRemove);

        this.updateIfNeeded();
    }

    public removeSubstitution(subToRemove: Events.ISubstitutionEvent): void {
        if (this.subs == undefined) {
            return;
        }

        this.subs = this.subs.filter((sub) => sub !== subToRemove);

        this.updateIfNeeded();
    }

    public removeThrownOutBonus(bonusIndex: number): void {
        if (this.thrownOutBonuses == undefined) {
            return;
        }

        this.thrownOutBonuses = this.thrownOutBonuses.filter(
            (thrownOutTossup) => thrownOutTossup.questionIndex !== bonusIndex
        );
        if (this.thrownOutBonuses.length === 0) {
            this.thrownOutBonuses = undefined;
        }

        // Go back to the old bonus
        if (this.bonusAnswer != undefined) {
            this.resetBonusAnswer();
            this.bonusAnswer.bonusIndex = bonusIndex - 1;
        }

        this.updateIfNeeded();
    }

    public removeThrownOutTossup(tossupIndex: number): void {
        if (this.thrownOutTossups == undefined) {
            return;
        }

        this.thrownOutTossups = this.thrownOutTossups.filter(
            (thrownOutTossup) => thrownOutTossup.questionIndex !== tossupIndex
        );
        if (this.thrownOutTossups.length === 0) {
            this.thrownOutTossups = undefined;
        }

        // If the latest tossup is no longer thrown out, then the correct buzz doesn't apply anymore
        this.removeCorrectBuzz();

        this.updateIfNeeded();
    }

    public removeTossupProtest(teamName: string): void {
        if (this.tossupProtests == undefined) {
            return;
        }

        this.tossupProtests = this.tossupProtests.filter((protest) => protest.teamName !== teamName);
        if (this.tossupProtests.length === 0) {
            this.tossupProtests = undefined;
        }

        this.updateIfNeeded();
    }

    public removeWrongBuzz(player: IPlayer, gameFormat: IGameFormat): void {
        if (this.wrongBuzzes == undefined) {
            return;
        }

        const oldLength: number = this.wrongBuzzes.length;
        this.wrongBuzzes = this.wrongBuzzes.filter((buzz) => !PlayerUtils.playersEqual(buzz.marker.player, player));
        if (this.wrongBuzzes.length === oldLength) {
            // Nothing left, don't make any changes
            return;
        }

        this.updateNeg(gameFormat);
        this.removeTossupProtest(player.teamName);

        this.updateIfNeeded();
    }

    public setBonusPartAnswer(index: number, teamName: string, points: number): void {
        if (this.bonusAnswer == undefined) {
            // Nothing to set, since there's no part
            return;
        } else if (this.bonusAnswer.parts == undefined) {
            // default to 3 or the the length an array would need to be to support the index, whichever is higher
            this.bonusAnswer.parts = new Array(Math.max(3, index + 1));
        }

        this.bonusAnswer.parts[index] = { teamName, points };

        this.updateIfNeeded();
    }

    public setUpdateHandler(handler: () => void | undefined): void {
        this.onUpdate = handler;
    }

    private resetBonusAnswer(): void {
        if (this.bonusAnswer != undefined) {
            const parts: Events.IBonusAnswerPart[] = this.bonusAnswer.parts ?? new Array(3);
            for (let i = 0; i < parts.length; i++) {
                parts[i] = { teamName: "", points: 0 };
            }

            this.bonusAnswer = {
                bonusIndex: this.bonusAnswer.bonusIndex,
                correctParts: [],
                receivingTeamName: this.bonusAnswer.receivingTeamName,
                parts,
            };
        }

        this.updateIfNeeded();
    }

    private removePlayerBuzzes(player: IPlayer): void {
        this.removeBuzzes((event) => PlayerUtils.playersEqual(player, event.marker.player));

        this.tossupProtests = this.tossupProtests?.filter((protest) => protest.teamName !== player.teamName);

        this.updateIfNeeded();
    }

    private removeTeamsBuzzes(teamName: string, tossupIndex: number): void {
        this.removeBuzzes((event) => event.tossupIndex === tossupIndex && event.marker.player.teamName === teamName);

        // TODO: Clear the (tossup) protests from this team. Figure out if we need to remove bonus protests too.
        this.tossupProtests = this.tossupProtests?.filter((protest) => protest.teamName !== teamName);
    }

    private removeBuzzes(filter: (event: Events.ITossupAnswerEvent) => boolean): void {
        if (this.correctBuzz && filter(this.correctBuzz)) {
            this.removeCorrectBuzz();
        } else if (this.wrongBuzzes && this.wrongBuzzes.findIndex((buzz) => filter(buzz)) >= 0) {
            this.wrongBuzzes = this.wrongBuzzes.filter((buzz) => !filter(buzz));
        }
    }

    private updateIfNeeded(): void {
        if (this.onUpdate) {
            this.onUpdate();
        }
    }

    // If we changed the order of wrongBuzzes, it may be that the first wrong buzz is different, so we need to
    // reset the point values for the wrong ubzzes
    private updateNeg(gameFormat: IGameFormat): void {
        if (
            this.wrongBuzzes != undefined &&
            this.wrongBuzzes.length > 0 &&
            this.wrongBuzzes[0].marker.isLastWord === false
        ) {
            this.wrongBuzzes[0].marker.points = gameFormat.negValue;
            for (let i = 1; i < this.wrongBuzzes.length; i++) {
                this.wrongBuzzes[i].marker.points = 0;
            }
        }
    }
}

export interface ICycle {
    correctBuzz?: Events.ITossupAnswerEvent;
    wrongBuzzes?: Events.ITossupAnswerEvent[];
    bonusAnswer?: Events.IBonusAnswerEvent;
    playerJoins?: Events.IPlayerJoinsEvent[];
    playerLeaves?: Events.IPlayerLeavesEvent[];
    subs?: Events.ISubstitutionEvent[];
    timeouts?: Events.ITimeoutEvent[];
    bonusProtests?: Events.IBonusProtestEvent[];
    tossupProtests?: Events.ITossupProtestEvent[];
    thrownOutTossups?: Events.IThrowOutQuestionEvent[];
    thrownOutBonuses?: Events.IThrowOutQuestionEvent[];

    // Obsolete; remove after a few release versions
    noPenaltyBuzzes?: Events.ITossupAnswerEvent[];
    negBuzz?: Events.ITossupAnswerEvent;
}
