import { observable, action, computed, makeObservable } from "mobx";
import { format } from "mobx-sync";

import * as CompareUtils from "./CompareUtils";
import * as Events from "./Events";
import { IBuzzMarker } from "./IBuzzMarker";
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

    constructor(deserializedCycle?: ICycle) {
        // We don't use makeAutoObservable because there are methods like getProtestableBonusPartIndexes which aren't
        // actions
        makeObservable(this, {
            correctBuzz: observable,
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
            orderedBuzzes: computed({ requiresReaction: true }),
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

        if (deserializedCycle) {
            this.bonusAnswer = deserializedCycle.bonusAnswer;
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

    public get orderedBuzzes(): Events.ITossupAnswerEvent[] {
        // Sort by tossupIndex, then by position. Tie breaker: negs before no penalties, negs/no penalties before correct
        const buzzes: Events.ITossupAnswerEvent[] = this.wrongBuzzes ? [...this.wrongBuzzes] : [];

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
                (buzz.marker.points <= 0 && otherBuzz.marker.points > 0) ||
                (buzz.marker.points < 0 && otherBuzz.marker.points >= 0)
                ? -1
                : 1;
        });

        return buzzes;
    }

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
        if (this.wrongBuzzes) {
            this.wrongBuzzes = this.wrongBuzzes.filter((buzz) => buzz.marker.position <= marker.position);
        }
    }

    public addWrongBuzz(marker: IBuzzMarker, tossupIndex: number, buzzIndex?: number): void {
        if (this.wrongBuzzes == undefined) {
            this.wrongBuzzes = [];
        }

        this.removeTeamsBuzzes(marker.player.teamName, tossupIndex);

        const event: Events.ITossupAnswerEvent = {
            marker,
            tossupIndex,
        };
        if (buzzIndex == undefined) {
            this.wrongBuzzes.push(event);
        } else {
            const laterBuzzes: Events.ITossupAnswerEvent[] = this.wrongBuzzes.splice(buzzIndex);
            this.wrongBuzzes.push(event);
            this.wrongBuzzes = this.wrongBuzzes.concat(laterBuzzes);
        }

        // Clear the correct buzz if it's before this one, since the correct buzz should be the last one
        if (this.correctBuzz && this.correctBuzz.marker.position < marker.position) {
            this.removeCorrectBuzz();
        }
    }

    public addBonusProtest(questionIndex: number, partIndex: number, reason: string, teamName: string): void {
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
            teamName,
        });
    }

    public addPlayerJoins(inPlayer: IPlayer): void {
        if (this.playerJoins == undefined) {
            this.playerJoins = [];
        }

        this.playerJoins.push({
            inPlayer,
        });
    }

    public addPlayerLeaves(outPlayer: IPlayer): void {
        if (this.playerLeaves == undefined) {
            this.playerLeaves = [];
        }

        this.playerLeaves.push({
            outPlayer,
        });

        this.removePlayerBuzzes(outPlayer);
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
    }

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
    }

    public removeCorrectBuzz(): void {
        this.correctBuzz = undefined;
        this.bonusAnswer = undefined;
        this.bonusProtests = undefined;
    }

    public removePlayerJoins(joinToRemove: Events.IPlayerJoinsEvent): void {
        if (this.playerJoins == undefined) {
            return;
        }

        this.playerJoins = this.playerJoins.filter((join) => join !== joinToRemove);
    }

    public removePlayerLeaves(leaveToRemove: Events.IPlayerLeavesEvent): void {
        if (this.playerLeaves == undefined) {
            return;
        }

        this.playerLeaves = this.playerLeaves.filter((leave) => leave !== leaveToRemove);
    }

    public removeSubstitution(subToRemove: Events.ISubstitutionEvent): void {
        if (this.subs == undefined) {
            return;
        }

        this.subs = this.subs.filter((sub) => sub !== subToRemove);
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
    }

    public removeTossupProtest(teamName: string): void {
        if (this.tossupProtests == undefined) {
            return;
        }

        this.tossupProtests = this.tossupProtests.filter((protest) => protest.teamName !== teamName);
        if (this.tossupProtests.length === 0) {
            this.tossupProtests = undefined;
        }
    }

    public removeWrongBuzz(player: IPlayer): void {
        // TODO: If there's a no penalty buzz and it's not at the end, it must be converted to a neg
        // https://github.com/alopezlago/MODAQ/issues/58
        // We won't know that it's not at the end unless we add another field to BuzzMarker (celerity?)
        this.wrongBuzzes = this.wrongBuzzes?.filter((buzz) => !CompareUtils.playersEqual(buzz.marker.player, player));

        this.removeTossupProtest(player.teamName);
    }

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

    private removePlayerBuzzes(player: IPlayer): void {
        this.removeBuzzes((event) => CompareUtils.playersEqual(player, event.marker.player));

        this.tossupProtests = this.tossupProtests?.filter((protest) => protest.teamName !== player.teamName);
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
