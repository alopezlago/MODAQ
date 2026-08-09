import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";
import { IGameFormat } from "../state/IGameFormat";

export type ThrowOutQuestionType = "tossup" | "bonus";

type ThrowOutScenario = "tiebreaker" | "protest" | "procedural";

function getScenario(
    appState: AppState,
    cycleIndex: number,
    questionType: ThrowOutQuestionType,
    gameFormat: IGameFormat
): ThrowOutScenario {
    // Cycles 0 through regulationTossupCount - 1 are regulation, so any cycle at or beyond regulationTossupCount is
    // an overtime tossup. A tiebreaker is a sudden-death tossup, played one at a time until the tie breaks:
    // - Standard formats (minimumOvertimeQuestionCount <= 1) are sudden death from the first overtime tossup, so
    //   every overtime tossup is a tiebreaker.
    // - Fixed-block formats (e.g. NAQT's three) read a minimumOvertimeQuestionCount block regardless of the score
    //   before going to sudden death, so tossups within that block fall through to the protest/procedural cases and
    //   only tossups past the block are tiebreakers.
    const isTiebreakerTossup: boolean =
        questionType === "tossup" &&
        cycleIndex >= gameFormat.regulationTossupCount &&
        (gameFormat.minimumOvertimeQuestionCount <= 1 ||
            cycleIndex >= gameFormat.regulationTossupCount + gameFormat.minimumOvertimeQuestionCount);
    if (isTiebreakerTossup) {
        return "tiebreaker";
    }

    // A bonus is only ever recorded after a correct tossup buzz, so a defined bonusAnswer always implies a
    // non-empty orderedBuzzes; checking the buzzes alone is sufficient to detect game data after this cycle.
    const hasGameDataAfter: boolean = appState.activeGame.cycles
        .slice(cycleIndex + 1)
        .some((cycle: Cycle) => cycle.orderedBuzzes.length > 0);
    return hasGameDataAfter ? "protest" : "procedural";
}

export interface IThrowOutQuestionPrompt {
    // The confirmation message shown before throwing out the question.
    message: string;
    // The 0-based packet index of the replacement question, or undefined if no replacement is available
    // (i.e. the packet has no more questions).
    replacementIndex: number | undefined;
}

// Builds the confirmation prompt shown before throwing out a question. Both the message and the replacement
// index are derived from the same scenario, based on where in the game the question falls:
// - An overtime tiebreaker tossup (sudden-death formats, which play overtime one tossup at a time)
// - Mid-match with no recorded events afterward (likely a moderator procedural error)
// - Mid-match with recorded events afterward (likely a protest resolution)
// Protest replacements pull from the end of the packet; tiebreaker and procedural replacements use the next
// sequential question.
export function getThrowOutQuestionPrompt(
    appState: AppState,
    cycleIndex: number,
    questionType: ThrowOutQuestionType,
    currentQuestionNumber: number // 1-based
): IThrowOutQuestionPrompt {
    const gameFormat: IGameFormat = appState.activeGame.gameFormat;
    const nextQuestionNumber: number = currentQuestionNumber + 1;
    const totalQuestionCount: number =
        questionType === "tossup" ? appState.activeGame.packet.tossups.length : appState.activeGame.packet.bonuses.length;
    const needsMoreQuestions: boolean = nextQuestionNumber > totalQuestionCount;

    const scenario: ThrowOutScenario = getScenario(appState, cycleIndex, questionType, gameFormat);

    let replacementIndex: number | undefined;
    if (needsMoreQuestions) {
        replacementIndex = undefined;
    } else if (scenario === "protest") {
        replacementIndex = totalQuestionCount - 1;
    } else {
        replacementIndex = nextQuestionNumber - 1;
    }

    let message: string;
    if (scenario === "tiebreaker") {
        message = needsMoreQuestions
            ? "This question is about to be thrown out, which normally happens due to a tiebreaker tossup going " +
              "unanswered. Additional questions need to be uploaded before it can be replaced."
            : "This question is about to be thrown out, which normally happens due to a tiebreaker tossup going " +
              `unanswered, and will be replaced with tossup ${nextQuestionNumber}.`;
    } else if (scenario === "protest") {
        message = needsMoreQuestions
            ? "This question is about to be thrown out, which typically is due to protest resolution and potential " +
              "further gameplay. Additional questions need to be uploaded before it can be replaced."
            : `This question is about to be thrown out and replaced with ${questionType} ${totalQuestionCount}, ` +
              "which typically is due to protest resolution and potential further gameplay.";
    } else {
        message = needsMoreQuestions
            ? "This question is about to be thrown out, which normally happens due to a moderator procedural error. " +
              "Additional questions need to be uploaded before it can be replaced. Is that your intended action?"
            : `This question is about to be thrown out and replaced with ${questionType} ${nextQuestionNumber}, ` +
              "which normally happens due to a moderator procedural error. Is that your intended action?";
    }

    return { message, replacementIndex };
}
