import { Team, Player } from "./TeamState";
import { IBuzzMarker } from "./IBuzzMarker";

export interface ITossupAnswerEvent {
    tossupIndex: number;
    marker: IBuzzMarker;
}

export interface IBonusAnswerEvent {
    bonusIndex: number;
    correctParts: number[];
    receivingTeam: Team;
}

export interface ITossupProtestEvent extends IProtestEvent {
    position: number;
}

export interface IBonusProtestEvent extends IProtestEvent {
    part: number;
}

export interface ISubstitutionEvent {
    inPlayer: Player;
    outPlayer: Player;
}

export interface IThrowOutQuestionEvent {
    questionIndex: number;
}

interface IProtestEvent {
    description: string;
    team: Team;
}