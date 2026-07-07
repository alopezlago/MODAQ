import React from "react";
import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";
import { UIState } from "../state/UIState";
import { ITossupWord, Tossup } from "../state/PacketState";
import { IGameFormat } from "../state/IGameFormat";
import { Player } from "../state/TeamState";
import { IBuzzMarker } from "../state/IBuzzMarker";
import { ITossupAnswerEvent } from "../state/Events";
import * as PlayerUtils from "../state/PlayerUtils";

export function selectWordFromClick(appState: AppState, event: React.MouseEvent<HTMLDivElement>): void {
    const target = event.target as HTMLDivElement;

    // I'd like to avoid looking for a specific HTML element instead of a class. This would mean giving QuestionWord a
    // fixed class.
    const questionWord: HTMLSpanElement | null = target.closest("span");
    if (questionWord == undefined || questionWord.getAttribute == undefined) {
        return;
    }

    const index = parseInt(questionWord.getAttribute("data-index") ?? "", 10);
    if (index < 0 || isNaN(index)) {
        return;
    }

    const uiState: UIState = appState.uiState;

    // Clicking the selected word normally deselects it, but when the microphone moved the selection there, the
    // user is clicking it to record a buzz, so keep it selected and show the menu
    const selectedIndex =
        uiState.selectedWordIndex === index && !uiState.trackReaderWithMicrophone ? -1 : index;
    uiState.setSelectedWordIndex(selectedIndex);
    uiState.showBuzzMenu(/* clearSelectedWordOnClose */ true);

    event.preventDefault();
    event.stopPropagation();
}

export function selectWordFromKeyboardEvent(appState: AppState, event: React.KeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLDivElement;

    // We're looking for spans with the word index that matches the selectedWordIndex
    const selectedWordIndexString: string = appState.uiState.selectedWordIndex.toString();
    const questionWords: HTMLCollectionOf<HTMLSpanElement> = target.getElementsByTagName("span");
    for (let i = 0; i < questionWords.length; i++) {
        const questionWord: HTMLSpanElement = questionWords[i];

        if (questionWord.getAttribute("data-index") === selectedWordIndexString) {
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);
            break;
        }
    }

    event.preventDefault();
    event.stopPropagation();
}

/**
 * Gets the words the reader will say out loud for this tossup, in buzzable word index order. Power markers and
 * pronunciation guides aren't read, and neither is the end-of-question marker.
 */
export function getWordsForReaderFollower(tossup: Tossup, gameFormat: IGameFormat): string[] {
    return tossup
        .getWords(gameFormat)
        .filter((word: ITossupWord) => word.canBuzzOn && !word.isLastWord)
        .map((word) => word.word.map((segment) => segment.text).join(""));
}

/**
 * Moves the buzz point to where the reader currently is in the tossup, so buzzes are easy to mark.
 */
export function updateBuzzPointFromReader(appState: AppState, wordIndex: number): void {
    const uiState: UIState = appState.uiState;

    // Don't move the buzz point out from under the user while they're marking a buzz
    if (uiState.buzzMenuState.visible) {
        return;
    }

    uiState.setSelectedWordIndex(wordIndex);
}

export function onReaderFollowerError(appState: AppState, message: string): void {
    appState.uiState.setTrackReaderWithMicrophone(false);
    appState.uiState.dialogState.showOKMessageDialog({
        title: "Microphone Tracking Stopped",
        message,
    });
}

export function updateReaderFollowerStatus(appState: AppState, engine: string, status: string): void {
    appState.uiState.setReaderFollowerStatus(engine, status);
}

export function updateReaderFollowerTranscript(appState: AppState, transcript: string): void {
    appState.uiState.setReaderFollowerTranscript(transcript);
}

export function updateReaderFollowerLivePosition(appState: AppState, position: number): void {
    appState.uiState.setReaderFollowerLivePosition(position);
}

export function updateReaderFollowerCue(appState: AppState, cue: string): void {
    appState.uiState.setReaderFollowerLastCue(cue);
}

// If the mouse moved over the question text in the last few seconds, the user is targeting a word manually, so
// the buzz shortcut shouldn't move the buzz point out from under them
const recentMouseMoveThresholdInMs = 3000;

/**
 * Handles the buzz shortcut (Space): opens the buzz menu at the buzz point. If the microphone tracking knows
 * where the reader is and the user isn't picking a word with the mouse, the buzz point anchors to the most
 * recently read word first.
 */
export function openBuzzMenuAtBuzzPoint(appState: AppState, now?: number): void {
    const uiState: UIState = appState.uiState;
    const tossup: Tossup | undefined = appState.game.getTossup(uiState.cycleIndex);
    if (tossup == undefined) {
        return;
    }

    const currentTime: number = now ?? Date.now();
    const isMouseOnText: boolean =
        currentTime - uiState.lastQuestionTextMouseMoveTime < recentMouseMoveThresholdInMs;
    const livePosition: number = uiState.readerFollowerLivePosition;

    if (!isMouseOnText && livePosition >= 0) {
        // Space is a buzz cue: anchor the buzz point to the most recently read word right away, shifted by the
        // user's configured offset (to compensate for recognition lag/lead) and clamped to the tossup
        uiState.setReaderFollowerLastCue("pressed Space");
        const lastBuzzableIndex: number =
            tossup.getWords(appState.game.gameFormat).filter((word) => word.canBuzzOn).length - 1;
        const offsetPosition: number = livePosition + uiState.buzzPointWordOffset;
        uiState.setSelectedWordIndex(Math.max(0, Math.min(lastBuzzableIndex, offsetPosition)));
    } else if (uiState.selectedWordIndex < 0) {
        // Nothing selected and no reading position known; fall back to the end of the tossup
        const words: ITossupWord[] = tossup.getWords(appState.game.gameFormat);
        uiState.setSelectedWordIndex(words.filter((word) => word.canBuzzOn).length - 1);
    }

    uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);
}

/**
 * Moves the buzz point by `delta` buzzable words, clamped to the tossup. Backs the Shift+Left/Shift+Right
 * shortcuts that let the moderator nudge the buzz point to the exact word while the buzz menu is open. Moving
 * the selected word re-anchors the open buzz menu to it.
 */
export function moveBuzzPoint(appState: AppState, delta: number): void {
    const uiState: UIState = appState.uiState;
    const tossup: Tossup | undefined = appState.game.getTossup(uiState.cycleIndex);
    if (tossup == undefined) {
        return;
    }

    const lastBuzzableIndex: number =
        tossup.getWords(appState.game.gameFormat).filter((word) => word.canBuzzOn).length - 1;
    if (lastBuzzableIndex < 0) {
        return;
    }

    // If nothing is selected yet, start from the end of the tossup (the buzz menu's own fallback)
    const current: number = uiState.selectedWordIndex >= 0 ? uiState.selectedWordIndex : lastBuzzableIndex;
    const next: number = Math.min(lastBuzzableIndex, Math.max(0, current + delta));
    if (next !== uiState.selectedWordIndex) {
        uiState.setSelectedWordIndex(next);
    }
}

// The index of the last buzzable word in the current tossup, or -1 if there isn't one.
function getLastBuzzableIndex(appState: AppState): number {
    const tossup: Tossup | undefined = appState.game.getTossup(appState.uiState.cycleIndex);
    if (tossup == undefined) {
        return -1;
    }

    return tossup.getWords(appState.game.gameFormat).filter((word) => word.canBuzzOn).length - 1;
}

// Longest word number a tossup could have; also caps how many digits the user can type
const maximumBuzzIndexDigits = 3;

// Once a 2- or 3-digit number has sat untouched this long, assume it's the intended word and open the buzz menu.
// (Single digits are left alone, since the reader may still be typing a longer number.)
const buzzIndexAutoCommitDelayInMs = 2000;

let buzzIndexAutoCommitTimer: number | undefined = undefined;

function clearBuzzIndexAutoCommit(): void {
    if (buzzIndexAutoCommitTimer != undefined) {
        window.clearTimeout(buzzIndexAutoCommitTimer);
        buzzIndexAutoCommitTimer = undefined;
    }
}

// (Re)arms the idle auto-commit timer after a keystroke: only when the number is 2-3 digits, and reset on every
// keystroke so it fires only after a pause.
function rearmBuzzIndexAutoCommit(appState: AppState): void {
    clearBuzzIndexAutoCommit();

    const length: number = appState.uiState.buzzIndexEntryValue.length;
    if (typeof window === "undefined" || (length !== 2 && length !== 3)) {
        return;
    }

    buzzIndexAutoCommitTimer = window.setTimeout(() => {
        buzzIndexAutoCommitTimer = undefined;
        // Guard against a stale timer firing after entry already ended (e.g. the question changed)
        if (appState.uiState.isEnteringBuzzIndex) {
            commitBuzzIndexEntry(appState);
        }
    }, buzzIndexAutoCommitDelayInMs);
}

/**
 * Starts word-number entry: the user types a word's number (shown above each word) and presses Enter to set the
 * buzz point there. Used by the Space shortcut when "type word number to buzz" mode is on.
 */
export function startBuzzIndexEntry(appState: AppState): void {
    const uiState: UIState = appState.uiState;
    clearBuzzIndexAutoCommit();
    uiState.setReaderFollowerLastCue("typing word number");
    uiState.setSelectedWordIndex(-1);
    uiState.startBuzzIndexEntry();
}

/**
 * Appends a typed digit to the word number and previews the buzz point at the matching word.
 */
export function appendBuzzIndexDigit(appState: AppState, digit: string): void {
    const uiState: UIState = appState.uiState;
    if (uiState.buzzIndexEntryValue.length >= maximumBuzzIndexDigits) {
        return;
    }

    uiState.setBuzzIndexEntryValue(uiState.buzzIndexEntryValue + digit);
    previewBuzzIndexSelection(appState);
    rearmBuzzIndexAutoCommit(appState);
}

/**
 * Removes the last typed digit from the word number and updates the preview.
 */
export function backspaceBuzzIndexDigit(appState: AppState): void {
    const uiState: UIState = appState.uiState;
    uiState.setBuzzIndexEntryValue(uiState.buzzIndexEntryValue.slice(0, -1));
    previewBuzzIndexSelection(appState);
    rearmBuzzIndexAutoCommit(appState);
}

// Highlights the word matching the number typed so far (1-based, clamped to the tossup), without opening the
// buzz menu yet, so the user can see where the buzz point will land as they type.
function previewBuzzIndexSelection(appState: AppState): void {
    const uiState: UIState = appState.uiState;
    const wordIndex: number = parseBuzzIndexSelection(appState);
    uiState.setSelectedWordIndex(wordIndex);
}

// Turns the typed word number into a 0-based buzzable word index, clamped to the tossup, or -1 if nothing's typed.
function parseBuzzIndexSelection(appState: AppState): number {
    const value: string = appState.uiState.buzzIndexEntryValue;
    if (value === "") {
        return -1;
    }

    const lastBuzzableIndex: number = getLastBuzzableIndex(appState);
    // The numbers shown above the words are 1-based, so the word index is the typed number minus one
    return Math.max(0, Math.min(lastBuzzableIndex, Number(value) - 1));
}

/**
 * Commits word-number entry: sets the buzz point to the typed word and opens the buzz menu there. If nothing was
 * typed, just cancels out of entry mode.
 */
export function commitBuzzIndexEntry(appState: AppState): void {
    const uiState: UIState = appState.uiState;
    clearBuzzIndexAutoCommit();
    const wordIndex: number = parseBuzzIndexSelection(appState);
    uiState.endBuzzIndexEntry();

    if (wordIndex < 0) {
        return;
    }

    uiState.setSelectedWordIndex(wordIndex);
    uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);
}

/**
 * Cancels word-number entry without setting a buzz point.
 */
export function cancelBuzzIndexEntry(appState: AppState): void {
    const uiState: UIState = appState.uiState;
    clearBuzzIndexAutoCommit();
    uiState.endBuzzIndexEntry();
    uiState.setSelectedWordIndex(-1);
}

/**
 * The players shown in the buzz menu, in display order (each team's active players in turn). Number keys pick
 * from this list.
 */
export function getBuzzMenuOrderedPlayers(appState: AppState): Player[] {
    const players: Player[] = [];
    for (const teamName of appState.game.teamNames) {
        players.push(...appState.game.getActivePlayers(teamName, appState.uiState.cycleIndex).values());
    }

    return players;
}

/**
 * The DOM id of a player's item in the buzz menu, so the keyboard handler can open their submenu.
 */
export function getBuzzMenuPlayerElementId(playerIndex: number): string {
    return `buzzMenuPlayer_${playerIndex}`;
}

/**
 * Handles a number key while the buzz menu is open: highlights that player and opens their Correct/Wrong
 * submenu, like clicking on them would. C/W also work directly once a player is selected.
 */
export function selectBuzzMenuPlayerByNumber(appState: AppState, digit: number): void {
    const index: number = digit - 1;
    if (index < 0 || index >= getBuzzMenuOrderedPlayers(appState).length) {
        return;
    }

    appState.uiState.setBuzzMenuSelectedPlayerIndex(index);

    // Clicking the player's menu item is how Fluent UI expands a submenu, and it also moves focus into it so
    // arrow keys/Enter work. document is undefined in unit tests, which only verify the state change.
    if (typeof document !== "undefined") {
        document.getElementById(getBuzzMenuPlayerElementId(index))?.click();
    }
}

/**
 * Handles C/W while the buzz menu is open with a player selected by number key: marks that player's buzz as
 * correct or wrong at the buzz point, then closes the menu. Marking an already-marked buzz removes it, like
 * clicking the menu item does.
 */
export function markKeyboardSelectedPlayerBuzz(appState: AppState, isCorrect: boolean): void {
    const uiState: UIState = appState.uiState;
    const selectedPlayerIndex: number | undefined = uiState.buzzMenuState.selectedPlayerIndex;
    if (!uiState.buzzMenuState.visible || selectedPlayerIndex == undefined) {
        return;
    }

    const player: Player | undefined = getBuzzMenuOrderedPlayers(appState)[selectedPlayerIndex];
    const cycle: Cycle | undefined = appState.game.cycles[uiState.cycleIndex];
    const tossupIndex: number = appState.game.getTossupIndex(uiState.cycleIndex);
    const tossup: Tossup | undefined = appState.game.packet.tossups[tossupIndex];
    const wordIndex: number = uiState.selectedWordIndex;
    if (player == undefined || cycle == undefined || tossup == undefined || wordIndex < 0) {
        return;
    }

    const gameFormat: IGameFormat = appState.game.gameFormat;

    if (isCorrect) {
        const isAlreadyCorrect: boolean =
            cycle.correctBuzz != undefined &&
            PlayerUtils.playersEqual(cycle.correctBuzz.marker.player, player) &&
            cycle.correctBuzz.marker.position === wordIndex;
        if (isAlreadyCorrect) {
            cycle.removeCorrectBuzz();
        } else {
            // Don't include a bonus index if there should be no bonus for this correct buzz
            const bonusIndex: number | undefined =
                gameFormat.overtimeIncludesBonuses || uiState.cycleIndex < gameFormat.regulationTossupCount
                    ? appState.game.getBonusIndex(uiState.cycleIndex)
                    : undefined;

            // If we don't know the number of parts, assume it's 3, which is standard
            const partsCount: number =
                bonusIndex != undefined && appState.game.packet.bonuses[bonusIndex] != undefined
                    ? appState.game.packet.bonuses[bonusIndex].parts.length
                    : 3;

            cycle.addCorrectBuzz(
                {
                    player,
                    position: wordIndex,
                    points: tossup.getPointsAtPosition(gameFormat, wordIndex),
                },
                tossupIndex,
                gameFormat,
                bonusIndex,
                partsCount
            );
        }
    } else {
        const isAlreadyWrong: boolean =
            cycle.wrongBuzzes != undefined &&
            cycle.wrongBuzzes.findIndex(
                (buzz) => PlayerUtils.playersEqual(buzz.marker.player, player) && buzz.marker.position === wordIndex
            ) >= 0;
        if (isAlreadyWrong) {
            cycle.removeWrongBuzz(player, gameFormat);
        } else {
            const words: ITossupWord[] = tossup.getWords(gameFormat);
            const lastBuzzableIndex: number = words.filter((word) => word.canBuzzOn).length - 1;
            const marker: IBuzzMarker = {
                isLastWord: wordIndex === lastBuzzableIndex,
                player,
                position: wordIndex,
                points: 0,
            };

            // If we're at the end of the question, or if there's already been a neg from a different team, then
            // make it a no penalty buzz
            const pointsAtPosition: number = tossup.getPointsAtPosition(gameFormat, wordIndex, false);
            if (pointsAtPosition < 0) {
                const negBuzz: ITossupAnswerEvent | undefined = cycle.wrongBuzzes?.find(
                    (buzz) => buzz.marker.points < 0
                );
                if (negBuzz == undefined || negBuzz.marker.player.teamName === player.teamName) {
                    marker.points = pointsAtPosition;
                }
            }

            cycle.addWrongBuzz(marker, tossupIndex, gameFormat);
        }
    }

    // Close the menu like a click would, honoring how the menu was opened
    uiState.hideBuzzMenu();
    if (uiState.buzzMenuState.clearSelectedWordOnClose) {
        uiState.setSelectedWordIndex(-1);
    }
}

export function throwOutTossup(
    appState: AppState,
    cycle: Cycle,
    tossupNumber: number,
    onThrownOut?: () => void
): void {
    appState.uiState.dialogState.showOKCancelMessageDialog({
        title: "Throw out Tossup",
        message:
            "Click OK to throw out the tossup. To undo this, click on the X next to its event in the Event Log." +
            (onThrownOut ? " If the packet runs out of tossups, the next tiebreaker question is added automatically." : ""),
        onOK: () => {
            onConfirmThrowOutTossup(appState, cycle, tossupNumber);
            if (onThrownOut) {
                onThrownOut();
            }
        },
    });
}

function onConfirmThrowOutTossup(appState: AppState, cycle: Cycle, tossupNumber: number) {
    cycle.addThrownOutTossup(tossupNumber - 1);
    appState.uiState.setSelectedWordIndex(-1);
}
