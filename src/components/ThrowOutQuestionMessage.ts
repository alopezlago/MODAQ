import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";
import { IGameFormat } from "../state/IGameFormat";

export type ThrowOutQuestionType = "tossup" | "bonus";

// Picks the confirmation message shown before throwing out a question, based on where in the game it falls:
// - The single tiebreaker tossup (standard formats that replace it, rather than appending more tiebreakers, e.g. NAQT)
// - Mid-match with no recorded events afterward (likely a moderator procedural error)
// - Mid-match with recorded events afterward (likely a protest resolution)
export function getThrowOutQuestionMessage(
    appState: AppState,
    cycleIndex: number,
    questionType: ThrowOutQuestionType,
    currentQuestionNumber: number
): string {
    const gameFormat: IGameFormat = appState.game.gameFormat;
    const nextQuestionNumber: number = currentQuestionNumber + 1;
    const totalQuestionCount: number =
        questionType === "tossup" ? appState.game.packet.tossups.length : appState.game.packet.bonuses.length;
    const needsMoreQuestions: boolean = nextQuestionNumber > totalQuestionCount;

    // Formats that need more than one tiebreaker question (e.g. NAQT's three-tossup tiebreaker) don't throw out and
    // replace the tiebreaker tossup; they just keep appending more, so this special-cased message doesn't apply.
    const isTiebreakerTossup: boolean =
        questionType === "tossup" &&
        cycleIndex === gameFormat.regulationTossupCount &&
        gameFormat.minimumOvertimeQuestionCount === 1;

    if (isTiebreakerTossup) {
        return needsMoreQuestions
            ? "This question is about to be thrown out, which normally happens due to a tiebreaker tossup going " +
                  "unanswered. Additional questions need to be uploaded before it can be replaced."
            : "This question is about to be thrown out, which normally happens due to a tiebreaker tossup going " +
                  `unanswered, and will be replaced with tossup ${nextQuestionNumber}.`;
    }

    const hasGameDataAfter: boolean = appState.game.cycles
        .slice(cycleIndex + 1)
        .some((cycle: Cycle) => cycle.orderedBuzzes.length > 0 || cycle.bonusAnswer != undefined);

    if (hasGameDataAfter) {
        return needsMoreQuestions
            ? "This question is about to be thrown out, which typically is due to protest resolution for further " +
                  "gameplay. Additional questions need to be uploaded before it can be replaced."
            : `This question is about to be thrown out and replaced with ${questionType} ${nextQuestionNumber}, ` +
                  "which typically is due to protest resolution for further gameplay.";
    }

    return needsMoreQuestions
        ? "This question is about to be thrown out, which normally happens due to a moderator procedural error. " +
              "Additional questions need to be uploaded before it can be replaced. Is that your intended action?"
        : `This question is about to be thrown out and replaced with ${questionType} ${nextQuestionNumber}, ` +
              "which normally happens due to a moderator procedural error. Is that your intended action?";
}
