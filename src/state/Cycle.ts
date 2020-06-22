import { observable, action, computed } from "mobx";

import * as Events from "./Events";
import { IBuzzMarker } from "./IBuzzMarker";
import { Team, Player } from "./TeamState";

// TODO: Build a stack of cycle changes, so we can support undo. This might mean that mobx isn't the best store for it
// (not as simple to go back)

export class Cycle {
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
    tosuspProtests?: Events.ITossupProtestEvent[];

    @observable
    thrownOutTossups?: Events.IThrowOutQuestionEvent[];

    @observable
    thrownOutBonuses?: Events.IThrowOutQuestionEvent[];

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
    public addCorrectBuzz(marker: IBuzzMarker, tossupIndex: number): void {
        this.removeTeamsBuzzes(marker.player.team);

        this.correctBuzz = {
            tossupIndex,
            marker,
        };

        // TODO: we need a method to set the bonus index (either passed in here or with a new method)
        // Alternatively, we can remove the tossupIndex/bonusIndex, and fill it in whenever we have to serialize this
        if (this.bonusAnswer == undefined || marker.player.team !== this.bonusAnswer.receivingTeam) {
            this.bonusAnswer = {
                bonusIndex: 0,
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
        this.removeTeamsBuzzes(marker.player.team);
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

        this.removeTeamsBuzzes(marker.player.team);

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
    public addBonusProtest(team: Team, questionIndex: number, part: number, reason: string): void {
        if (this.bonusProtests == undefined) {
            this.bonusProtests = [];
        }

        this.bonusProtests.push({
            reason: reason,
            part,
            questionIndex,
            team,
        });
    }

    @action
    public addTossupProtest(team: Team, questionIndex: number, position: number, reason: string): void {
        if (this.tosuspProtests == undefined) {
            this.tosuspProtests = [];
        }

        this.tosuspProtests.push({
            reason: reason,
            position,
            questionIndex,
            team,
        });
    }

    @action
    public removeBonusProtest(part: number): void {
        this.bonusProtests = this.bonusProtests?.filter((protest) => protest.part !== part);
        if (this.bonusProtests?.length === 0) {
            this.bonusProtests = undefined;
        }
    }

    @action
    public removeCorrectBuzz(): void {
        this.correctBuzz = undefined;
        this.bonusAnswer = undefined;
    }

    @action
    public removeTossupProtest(team: Team): void {
        this.tosuspProtests = this.tosuspProtests?.filter((protest) => protest.team !== team);
        if (this.tosuspProtests?.length === 0) {
            this.tosuspProtests = undefined;
        }
    }

    @action
    public removeWrongBuzz(player: Player): void {
        if (this.negBuzz?.marker.player === player) {
            this.negBuzz = undefined;
        } else {
            this.noPenaltyBuzzes = this.noPenaltyBuzzes?.filter((buzz) => buzz.marker.player !== player);
        }
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

    private removeTeamsBuzzes(team: Team): void {
        if (this.correctBuzz?.marker.player.team === team) {
            this.removeCorrectBuzz();
        } else if (this.negBuzz?.marker.player.team === team) {
            this.negBuzz = undefined;
        } else if (
            this.noPenaltyBuzzes &&
            this.noPenaltyBuzzes.findIndex((buzz) => buzz.marker.player.team === team) >= 0
        ) {
            this.noPenaltyBuzzes = this.noPenaltyBuzzes.filter((buzz) => buzz.marker.player.team !== team);
        }

        // TODO: Clear the (tossup) protests from this team. Figure out if we need to remove bonus protests too.
        this.tosuspProtests = this.tosuspProtests?.filter((protest) => protest.team !== team);
    }
}
