import { observable, action, computed } from "mobx";

import * as CompareUtils from "./CompareUtils";
import * as Events from "./Events";
import { IBuzzMarker } from "./IBuzzMarker";
import { IPlayer } from "./TeamState";

// TODO: Build a stack of cycle changes, so we can support undo. This might mean that mobx isn't the best store for it
// (not as simple to go back)

export class Cycle implements ICycle {
    @observable
    negBuzz?: Events.ITossupAnswerEvent;

    @observable
    correctBuzz?: Events.ITossupAnswerEvent;

    @observable
    noPenaltyBuzzes?: Events.ITossupAnswerEvent[];

    @observable
    bonusAnswer?: Events.IBonusAnswerEvent;

    @observable
    playerJoins?: Events.IPlayerJoinsEvent[];

    @observable
    playerLeaves?: Events.IPlayerLeavesEvent[];

    @observable
    subs?: Events.ISubstitutionEvent[];

    @observable
    timeouts?: Events.ITimeoutEvent[];

    @observable
    bonusProtests?: Events.IBonusProtestEvent[];

    @observable
    tossupProtests?: Events.ITossupProtestEvent[];

    @observable
    thrownOutTossups?: Events.IThrowOutQuestionEvent[];

    @observable
    thrownOutBonuses?: Events.IThrowOutQuestionEvent[];

    constructor(deserializedCycle?: ICycle) {
        if (deserializedCycle) {
            this.bonusAnswer = deserializedCycle.bonusAnswer;
            this.bonusProtests = deserializedCycle.bonusProtests;
            this.correctBuzz = deserializedCycle.correctBuzz;
            this.negBuzz = deserializedCycle.negBuzz;
            this.playerJoins = deserializedCycle.playerJoins;
            this.playerLeaves = deserializedCycle.playerLeaves;
            this.subs = deserializedCycle.subs;
            this.timeouts = deserializedCycle.timeouts;
            this.thrownOutBonuses = deserializedCycle.thrownOutBonuses;
            this.thrownOutTossups = deserializedCycle.thrownOutTossups;
            this.tossupProtests = deserializedCycle.tossupProtests;
        }
    }

    @computed({ requiresReaction: true })
    public get incorrectBuzzes(): Events.ITossupAnswerEvent[] {
        const noPenaltyBuzzes: Events.ITossupAnswerEvent[] = this.noPenaltyBuzzes ?? [];
        return this.negBuzz != undefined ? noPenaltyBuzzes.concat(this.negBuzz) : noPenaltyBuzzes;
    }

    @computed({ requiresReaction: true })
    public get orderedBuzzes(): Events.ITossupAnswerEvent[] {
        // Sort by tossupIndex, then by position. Tie breaker: negs before no penalties, negs/no penalties before correct
        const buzzes: Events.ITossupAnswerEvent[] = this.noPenaltyBuzzes ? [...this.noPenaltyBuzzes] : [];
        if (this.negBuzz) {
            buzzes.push(this.negBuzz);
        }

        if (this.correctBuzz) {
            buzzes.push(this.correctBuzz);
        }

        // Prioritization should be
        // - Buzzes on earlier tossups
        // - Buzzes earlier in the tossup
        // - Incorrect buzzes before correct ones
        // - Negs before no penalty buzzes
        // If we decide to store the point value with the buzz, just compare the point values
        buzzes.sort((buzz, otherBuzz) => {
            if (buzz.tossupIndex < otherBuzz.tossupIndex) {
                return -1;
            } else if (buzz.marker.position < otherBuzz.marker.position) {
                return -1;
            }

            return buzz.tossupIndex < otherBuzz.tossupIndex ||
                buzz.marker.position < otherBuzz.marker.position ||
                (!buzz.marker.correct && otherBuzz.marker.correct) ||
                buzz === this.negBuzz
                ? -1
                : 1;
        });

        return buzzes;
    }

    @action
    public addCorrectBuzz(marker: IBuzzMarker, tossupIndex: number, bonusIndex: number): void {
        this.removeTeamsBuzzes(marker.player.teamName, tossupIndex);

        this.correctBuzz = {
            tossupIndex,
            marker,
        };

        // TODO: we need a method to set the bonus index (either passed in here or with a new method)
        // Alternatively, we can remove the tossupIndex/bonusIndex, and fill it in whenever we have to serialize this
        if (this.bonusAnswer == undefined || marker.player.teamName !== this.bonusAnswer.receivingTeamName) {
            this.bonusAnswer = {
                bonusIndex,
                correctParts: [],
                receivingTeamName: marker.player.teamName,
            };
        }

        // We should also remove all buzzes after this one, since a correct buzz should be the last one.
        if (this.negBuzz && this.negBuzz.marker.position > marker.position) {
            this.negBuzz = undefined;
        }

        if (this.noPenaltyBuzzes) {
            this.noPenaltyBuzzes = this.noPenaltyBuzzes.filter((buzz) => buzz.marker.position <= marker.position);
        }
    }

    @action
    public addNeg(marker: IBuzzMarker, tossupIndex: number): void {
        this.removeTeamsBuzzes(marker.player.teamName, tossupIndex);
        this.negBuzz = {
            marker,
            tossupIndex,
        };

        // Clear the correct buzz if it's before this one, since the correct buzz should be the last one
        if (this.correctBuzz && this.correctBuzz.marker.position < marker.position) {
            this.removeCorrectBuzz();
        }
    }

    @action
    public addNoPenaltyBuzz(marker: IBuzzMarker, tossupIndex: number, buzzIndex?: number): void {
        if (this.noPenaltyBuzzes == undefined) {
            this.noPenaltyBuzzes = [];
        }

        this.removeTeamsBuzzes(marker.player.teamName, tossupIndex);

        const event: Events.ITossupAnswerEvent = {
            marker,
            tossupIndex,
        };
        if (buzzIndex == undefined) {
            this.noPenaltyBuzzes.push(event);
        } else {
            const laterBuzzes: Events.ITossupAnswerEvent[] = this.noPenaltyBuzzes.splice(buzzIndex);
            this.noPenaltyBuzzes.push(event);
            this.noPenaltyBuzzes = this.noPenaltyBuzzes.concat(laterBuzzes);
        }

        // Clear the correct buzz if it's before this one, since the correct buzz should be the last one
        if (this.correctBuzz && this.correctBuzz.marker.position < marker.position) {
            this.removeCorrectBuzz();
        }
    }

    @action
    public addBonusProtest(questionIndex: number, partIndex: number, reason: string): void {
        if (this.correctBuzz == undefined) {
            // There's no correct buzz, so there's no one to protest the bonus
            return;
        }

        if (this.bonusProtests == undefined) {
            this.bonusProtests = [];
        }

        // TODO: Investigate if we can get the questionIndex from the bonusAnswer event
        this.bonusProtests.push({
            reason: reason,
            partIndex,
            questionIndex,
            teamName: this.correctBuzz.marker.player.teamName,
        });
    }

    @action
    public addPlayerJoins(inPlayer: IPlayer): void {
        if (this.playerJoins == undefined) {
            this.playerJoins = [];
        }

        this.playerJoins.push({
            inPlayer,
        });
    }

    @action
    public addPlayerLeaves(outPlayer: IPlayer): void {
        if (this.playerLeaves == undefined) {
            this.playerLeaves = [];
        }

        this.playerLeaves.push({
            outPlayer,
        });
    }

    @action
    public addSwapSubstitution(inPlayer: IPlayer, outPlayer: IPlayer): void {
        if (this.subs == undefined) {
            this.subs = [];
        }

        this.subs.push({
            inPlayer,
            outPlayer,
        });
    }

    @action
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
    }

    @action
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
    }

    @action
    public addTossupProtest(teamName: string, questionIndex: number, position: number, reason: string): void {
        if (this.tossupProtests == undefined) {
            this.tossupProtests = [];
        }

        this.tossupProtests.push({
            reason: reason,
            position,
            questionIndex,
            teamName,
        });
    }

    // TODO: Try to make this a computed function
    public getProtestableBonusPartIndexes(bonusPartsCount: number): number[] {
        const indexes: number[] = [];

        const protestIndexes: number[] = this.bonusProtests?.map((protest) => protest.partIndex) ?? [];
        const protestedOrCorrectIndexes: number[] =
            this.bonusAnswer?.correctParts.map((part) => part.index).concat(protestIndexes) ?? protestIndexes;
        const protestedOrCorrectIndexesSet = new Set(protestedOrCorrectIndexes);

        for (let i = 0; i < bonusPartsCount; i++) {
            if (!protestedOrCorrectIndexesSet.has(i)) {
                indexes.push(i);
            }
        }

        return indexes;
    }

    @action
    public removeBonusProtest(partIndex: number): void {
        if (this.bonusProtests == undefined) {
            return;
        }

        this.bonusProtests = this.bonusProtests.filter((protest) => protest.partIndex !== partIndex);
        if (this.bonusProtests.length === 0) {
            this.bonusProtests = undefined;
        }
    }

    @action
    public removeCorrectBuzz(): void {
        this.correctBuzz = undefined;
        this.bonusAnswer = undefined;
    }

    @action
    public removePlayerJoins(joinToRemove: Events.IPlayerJoinsEvent): void {
        if (this.playerJoins == undefined) {
            return;
        }

        this.playerJoins = this.playerJoins.filter((join) => join !== joinToRemove);
    }

    @action
    public removePlayerLeaves(leaveToRemove: Events.IPlayerLeavesEvent): void {
        if (this.playerLeaves == undefined) {
            return;
        }

        this.playerLeaves = this.playerLeaves.filter((leave) => leave !== leaveToRemove);
    }

    @action
    public removeSubstitution(subToRemove: Events.ISubstitutionEvent): void {
        if (this.subs == undefined) {
            return;
        }

        this.subs = this.subs.filter((sub) => sub !== subToRemove);
    }

    @action
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
    }

    @action
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
    }

    @action
    public removeTossupProtest(teamName: string): void {
        if (this.tossupProtests == undefined) {
            return;
        }

        this.tossupProtests = this.tossupProtests.filter((protest) => protest.teamName !== teamName);
        if (this.tossupProtests.length === 0) {
            this.tossupProtests = undefined;
        }
    }

    @action
    public removeWrongBuzz(player: IPlayer): void {
        if (this.negBuzz && CompareUtils.playersEqual(this.negBuzz.marker.player, player)) {
            this.negBuzz = undefined;
        } else {
            this.noPenaltyBuzzes = this.noPenaltyBuzzes?.filter(
                (buzz) => !CompareUtils.playersEqual(buzz.marker.player, player)
            );
        }

        this.removeTossupProtest(player.teamName);
    }

    @action
    public setBonusPartAnswer(index: number, isCorrect: boolean, points = 0): void {
        // TODO: Remove this if statement when we start calling addCorrectBuzz.
        if (this.bonusAnswer == undefined) {
            if (this.correctBuzz != undefined) {
                this.bonusAnswer = {
                    bonusIndex: 0,
                    correctParts: isCorrect ? [{ index, points }] : [],
                    receivingTeamName: this.correctBuzz.marker.player.teamName,
                };
            }

            return;
        }

        // TODO: Consider adding a check to verify that isCorrect -> points > 0

        const indexInCorrectParts: number = this.bonusAnswer.correctParts.findIndex((part) => part.index === index);
        if (!isCorrect && indexInCorrectParts >= 0) {
            this.bonusAnswer.correctParts.splice(indexInCorrectParts, 1);
        } else if (isCorrect && indexInCorrectParts < 0) {
            this.bonusAnswer.correctParts.push({ index, points });
        }
    }

    private resetBonusAnswer(): void {
        if (this.bonusAnswer != undefined) {
            this.bonusAnswer = {
                bonusIndex: this.bonusAnswer.bonusIndex,
                correctParts: [],
                receivingTeamName: this.bonusAnswer.receivingTeamName,
            };
        }
    }

    private removeTeamsBuzzes(teamName: string, tossupIndex: number): void {
        if (
            this.correctBuzz &&
            this.correctBuzz.tossupIndex === tossupIndex &&
            this.correctBuzz.marker.player.teamName === teamName
        ) {
            this.removeCorrectBuzz();
        } else if (
            this.negBuzz &&
            this.negBuzz.tossupIndex === tossupIndex &&
            this.negBuzz.marker.player.teamName === teamName
        ) {
            // There can still only be one neg if a tossup is thrown out, because the next buzz would have occurred after
            // that buzz (i.e. been a missed buzz with no penalty)
            this.negBuzz = undefined;
        } else if (
            this.noPenaltyBuzzes &&
            this.noPenaltyBuzzes.findIndex(
                (buzz) => buzz.tossupIndex === tossupIndex && buzz.marker.player.teamName === teamName
            ) >= 0
        ) {
            this.noPenaltyBuzzes = this.noPenaltyBuzzes.filter(
                (buzz) => buzz.tossupIndex !== tossupIndex || buzz.marker.player.teamName !== teamName
            );
        }

        // TODO: Clear the (tossup) protests from this team. Figure out if we need to remove bonus protests too.
        this.tossupProtests = this.tossupProtests?.filter((protest) => protest.teamName !== teamName);
    }
}

export interface ICycle {
    negBuzz?: Events.ITossupAnswerEvent;
    correctBuzz?: Events.ITossupAnswerEvent;
    noPenaltyBuzzes?: Events.ITossupAnswerEvent[];
    bonusAnswer?: Events.IBonusAnswerEvent;
    playerJoins?: Events.IPlayerJoinsEvent[];
    playerLeaves?: Events.IPlayerLeavesEvent[];
    subs?: Events.ISubstitutionEvent[];
    timeouts?: Events.ITimeoutEvent[];
    bonusProtests?: Events.IBonusProtestEvent[];
    tossupProtests?: Events.ITossupProtestEvent[];
    thrownOutTossups?: Events.IThrowOutQuestionEvent[];
    thrownOutBonuses?: Events.IThrowOutQuestionEvent[];
}
