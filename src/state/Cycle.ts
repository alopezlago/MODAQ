import { observable, action, computed } from "mobx";

import * as CompareUtils from "./CompareUtils";
import * as Events from "./Events";
import { IBuzzMarker } from "./IBuzzMarker";
import { Team, ITeam, IPlayer } from "./TeamState";

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
    subs?: Events.ISubstitutionEvent[];

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
            this.subs = deserializedCycle.subs;
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
        this.removeTeamsBuzzes(marker.player.team, tossupIndex);

        this.correctBuzz = {
            tossupIndex,
            marker,
        };

        // TODO: we need a method to set the bonus index (either passed in here or with a new method)
        // Alternatively, we can remove the tossupIndex/bonusIndex, and fill it in whenever we have to serialize this
        if (
            this.bonusAnswer == undefined ||
            !CompareUtils.teamsEqual(marker.player.team, this.bonusAnswer.receivingTeam)
        ) {
            this.bonusAnswer = {
                bonusIndex,
                correctParts: [],
                receivingTeam: marker.player.team,
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
        this.removeTeamsBuzzes(marker.player.team, tossupIndex);
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

        this.removeTeamsBuzzes(marker.player.team, tossupIndex);

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
    public addBonusProtest(team: ITeam, questionIndex: number, partIndex: number, reason: string): void {
        if (this.bonusProtests == undefined) {
            this.bonusProtests = [];
        }

        // TODO: Investigate if we can get the questionIndex from the bonusAnswer event
        this.bonusProtests.push({
            reason: reason,
            partIndex,
            questionIndex,
            team,
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
    public addTossupProtest(team: ITeam, questionIndex: number, position: number, reason: string): void {
        if (this.tossupProtests == undefined) {
            this.tossupProtests = [];
        }

        this.tossupProtests.push({
            reason: reason,
            position,
            questionIndex,
            team,
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
    public removeTossupProtest(team: ITeam): void {
        if (this.tossupProtests == undefined) {
            return;
        }

        this.tossupProtests = this.tossupProtests.filter((protest) => !CompareUtils.teamsEqual(protest.team, team));
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

        this.removeTossupProtest(player.team);
    }

    @action
    public setBonusPartAnswer(index: number, isCorrect: boolean, points = 0): void {
        // TODO: Remove this if statement when we start calling addCorrectBuzz.
        if (this.bonusAnswer == undefined) {
            this.bonusAnswer = {
                bonusIndex: 0,
                correctParts: isCorrect ? [{ index, points }] : [],
                receivingTeam: new Team(),
            };
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
                receivingTeam: this.bonusAnswer.receivingTeam,
            };
        }
    }

    private removeTeamsBuzzes(team: ITeam, tossupIndex: number): void {
        if (
            this.correctBuzz &&
            this.correctBuzz.tossupIndex === tossupIndex &&
            CompareUtils.teamsEqual(this.correctBuzz.marker.player.team, team)
        ) {
            this.removeCorrectBuzz();
        } else if (
            this.negBuzz &&
            this.negBuzz.tossupIndex === tossupIndex &&
            CompareUtils.teamsEqual(this.negBuzz.marker.player.team, team)
        ) {
            // There can still only be one neg if a tossup is thrown out, because the next buzz would have occurred after
            // that buzz (i.e. been a missed buzz with no penalty)
            this.negBuzz = undefined;
        } else if (
            this.noPenaltyBuzzes &&
            this.noPenaltyBuzzes.findIndex(
                (buzz) => buzz.tossupIndex === tossupIndex && CompareUtils.teamsEqual(buzz.marker.player.team, team)
            ) >= 0
        ) {
            this.noPenaltyBuzzes = this.noPenaltyBuzzes.filter(
                (buzz) => buzz.tossupIndex !== tossupIndex || !CompareUtils.teamsEqual(buzz.marker.player.team, team)
            );
        }

        // TODO: Clear the (tossup) protests from this team. Figure out if we need to remove bonus protests too.
        this.tossupProtests = this.tossupProtests?.filter((protest) => !CompareUtils.teamsEqual(protest.team, team));
    }
}

export interface ICycle {
    negBuzz?: Events.ITossupAnswerEvent;
    correctBuzz?: Events.ITossupAnswerEvent;
    noPenaltyBuzzes?: Events.ITossupAnswerEvent[];
    bonusAnswer?: Events.IBonusAnswerEvent;
    subs?: Events.ISubstitutionEvent[];
    bonusProtests?: Events.IBonusProtestEvent[];
    tossupProtests?: Events.ITossupProtestEvent[];
    thrownOutTossups?: Events.IThrowOutQuestionEvent[];
    thrownOutBonuses?: Events.IThrowOutQuestionEvent[];
}
