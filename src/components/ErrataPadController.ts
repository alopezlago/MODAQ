import * as CycleChooserController from "./CycleChooserController";
import * as ErrataDialogController from "./dialogs/ErrataDialogController";
import { getWordsForReaderFollower } from "./TossupQuestionController";
import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";
import { GameState } from "../state/GameState";
import { QuestionType } from "../state/IErratum";
import { Tossup } from "../state/PacketState";
import { IErrataPad, UIState } from "../state/UIState";

/**
 * The kinds of error the errata pad offers, in the order of their number keys. The last one has no name worth
 * saving on its own, so picking it always opens the errata dialog to describe it.
 */
export const errataKinds: readonly string[] = [
    "Grammar",
    "Factual error",
    "Answer line issue",
    "Misplaced clue",
    "Repeat",
    "Other",
];

const otherKindIndex: number = errataKinds.length - 1;

// The words leading up to the reader's position that go into the note, so whoever fixes the packet can find the
// spot without counting words
const contextWordCount = 4;

// How long the "Noted" message stays up after the pad closes
const noticeDurationInMs = 3000;

let noticeTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * The E shortcut: opens the errata pad on the question being read. That's the bonus once the tossup has been
 * converted and its bonus is up, otherwise the tossup. With read-along on, the pad also remembers where in the tossup
 * the reader was, so the note can say where the error is.
 */
export function showPad(appState: AppState): void {
    const game: GameState = appState.activeGame;
    const uiState: UIState = appState.uiState;
    const cycle: Cycle | undefined = game.playableCycles[uiState.cycleIndex];
    if (cycle == undefined) {
        return;
    }

    const tossupIndex: number = game.getTossupIndex(uiState.cycleIndex);
    const bonusIndex: number = game.getBonusIndex(uiState.cycleIndex);
    const tossup: Tossup | undefined = game.packet.tossups[tossupIndex];
    const hasBonus: boolean = bonusIndex >= 0 && bonusIndex < game.packet.bonuses.length;
    if (tossup == undefined && !hasBonus) {
        return;
    }

    const onBonus: boolean = uiState.oneQuestionAtATime
        ? CycleChooserController.isOnBonus(appState)
        : CycleChooserController.hasBonusStep(appState, uiState.cycleIndex);

    appState.uiState.showErrataPad({
        tossupNumber: tossupIndex + 1,
        bonusNumber: hasBonus ? bonusIndex + 1 : undefined,
        questionType: (onBonus && hasBonus) || tossup == undefined ? "bonus" : "tossup",
        tossupLocation: tossup != undefined ? describeReaderPosition(appState, tossup) : undefined,
    });
}

export function hidePad(appState: AppState): void {
    appState.uiState.hideErrataPad();
}

/**
 * T and B: note the erratum against the tossup or the bonus instead
 */
export function setQuestionType(appState: AppState, questionType: QuestionType): void {
    const pad: IErrataPad | undefined = appState.uiState.errataPad;
    if (pad == undefined || (questionType === "bonus" && pad.bonusNumber == undefined)) {
        return;
    }

    appState.uiState.setErrataPadQuestionType(questionType);
}

/**
 * A number key or a button on the pad: notes that kind of error on the question, after any errata it already has.
 * With `describe` (Shift, or the last kind, Other) the errata dialog opens on the note instead, to add the details;
 * nothing is saved until the dialog is.
 */
export function noteErratum(appState: AppState, kindIndex: number, describe: boolean): void {
    const pad: IErrataPad | undefined = appState.uiState.errataPad;
    const kind: string | undefined = errataKinds[kindIndex];
    if (pad == undefined || kind == undefined) {
        return;
    }

    const questionNumber: number | undefined = pad.questionType === "bonus" ? pad.bonusNumber : pad.tossupNumber;
    if (questionNumber == undefined) {
        return;
    }

    const location: string | undefined = pad.questionType === "tossup" ? pad.tossupLocation : undefined;
    const note: string = location != undefined ? `${kind} ${location}` : kind;
    const existing: string = appState.errata.getErratum(questionNumber, pad.questionType)?.text ?? "";
    const text: string = existing.length > 0 ? `${existing}\n${note}` : note;

    appState.uiState.hideErrataPad();
    if (describe || kindIndex === otherKindIndex) {
        appState.uiState.dialogState.showErrataDialog(
            questionNumber,
            pad.questionType,
            text + ": ",
            /* existed */ existing.length > 0
        );
        return;
    }

    appState.errata.setErratum({
        questionNumber,
        questionType: pad.questionType,
        thrownOut: appState.errata.getErratum(questionNumber, pad.questionType)?.thrownOut ?? false,
        text,
    });
    showNotice(appState, `Noted on ${pad.questionType} ${questionNumber}: ${note}`);
}

/**
 * Opens the full errata dialog on the pad's question, for writing a note out by hand
 */
export function openDialog(appState: AppState): void {
    const pad: IErrataPad | undefined = appState.uiState.errataPad;
    if (pad == undefined) {
        return;
    }

    const questionNumber: number | undefined = pad.questionType === "bonus" ? pad.bonusNumber : pad.tossupNumber;
    appState.uiState.hideErrataPad();
    if (questionNumber != undefined) {
        ErrataDialogController.showDialog(appState, questionNumber, pad.questionType);
    }
}

/**
 * Where read-along last heard the reader in the tossup: the few words up to that point and the word's place, e.g.
 * `at "…by the Duke of Wellington" (word 42 of 118)`. Undefined when the microphone is off or hasn't placed the
 * reader in this tossup yet.
 */
export function describeReaderPosition(appState: AppState, tossup: Tossup): string | undefined {
    const uiState: UIState = appState.uiState;
    const position: number = uiState.readerFollowerLivePosition;
    if (!uiState.trackReaderWithMicrophone || position < 0) {
        return undefined;
    }

    const words: string[] = getWordsForReaderFollower(tossup, appState.activeGame.gameFormat);
    if (position >= words.length) {
        return undefined;
    }

    const start: number = Math.max(0, position - contextWordCount + 1);
    const context: string = words.slice(start, position + 1).join(" ");
    return `at “${start > 0 ? "…" : ""}${context}” (word ${position + 1} of ${words.length})`;
}

function showNotice(appState: AppState, notice: string): void {
    appState.uiState.setErrataNotice(notice);
    if (noticeTimer != undefined) {
        clearTimeout(noticeTimer);
    }

    noticeTimer = setTimeout(() => {
        noticeTimer = undefined;
        appState.uiState.setErrataNotice(undefined);
    }, noticeDurationInMs);
}
