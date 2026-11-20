import * as ExportController from "../ExportController";
import { AppState } from "../../state/AppState";
import { Cycle } from "../../state/Cycle";
import { GameState } from "../../state/GameState";
import { QuestionType } from "../../state/IErratum";

export interface IQuestionReference {
    questionNumber: number;
    questionType: QuestionType;
}

/**
 * Marks (or, if it's only marked, unmarks) a question as having an erratum. During the round that's all the
 * moderator does; they add the details when they review the errata at the end of the round.
 */
export function toggleMark(appState: AppState, questionNumber: number, questionType: QuestionType): void {
    appState.errata.toggleMark(questionNumber, questionType);
}

/**
 * The R shortcut: marks the question being read. That's the bonus once a team has earned it, and the tossup before
 * then.
 */
export function toggleMarkOnCurrentQuestion(appState: AppState): void {
    const question: IQuestionReference | undefined = getCurrentQuestion(appState);
    if (question != undefined) {
        toggleMark(appState, question.questionNumber, question.questionType);
    }
}

export function getCurrentQuestion(appState: AppState): IQuestionReference | undefined {
    const game: GameState = appState.activeGame;
    const cycleIndex: number = appState.uiState.cycleIndex;
    const cycle: Cycle | undefined = game.playableCycles[cycleIndex];
    if (cycle == undefined) {
        return undefined;
    }

    if (cycle.correctBuzz != undefined) {
        const bonusIndex: number = game.getBonusIndex(cycleIndex);
        const bonusIsRead: boolean =
            game.gameFormat.overtimeIncludesBonuses || cycleIndex < game.gameFormat.regulationTossupCount;
        if (bonusIsRead && bonusIndex >= 0 && bonusIndex < game.packet.bonuses.length) {
            return { questionNumber: bonusIndex + 1, questionType: "bonus" };
        }
    }

    const tossupIndex: number = game.getTossupIndex(cycleIndex);
    if (tossupIndex >= 0 && tossupIndex < game.packet.tossups.length) {
        return { questionNumber: tossupIndex + 1, questionType: "tossup" };
    }

    return undefined;
}

export function changeText(appState: AppState, questionNumber: number, questionType: QuestionType, text: string): void {
    appState.errata.setText(questionNumber, questionType, text);
}

export function removeErratum(appState: AppState, questionNumber: number, questionType: QuestionType): void {
    appState.errata.removeErratum(questionNumber, questionType);
}

/**
 * Finishes the end-of-round review and moves on to the export. Errata are saved as they're edited, so there's
 * nothing to commit here.
 */
export function continueToExport(appState: AppState): void {
    hideDialog(appState);
    ExportController.exportGame(appState);
}

export function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideErrataDialog();
}
