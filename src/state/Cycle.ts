import { observable } from "mobx";

import * as Events from "./Events";

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
    thrownOutTossups?: Events.IThrowOutTossupEvent[];

    @observable
    thrownOutBonuses?: Events.IThrowOutBonusEvent[];
}