import React from "react";
import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";
import { IBuzzPointPlacement, UIState } from "../state/UIState";
import { ModalVisibilityStatus } from "../state/ModalVisibilityStatus";
import { getThrowOutQuestionPrompt } from "./ThrowOutQuestionMessage";
import { ITossupWord, Tossup } from "../state/PacketState";
import { IGameFormat } from "../state/IGameFormat";
import { Player } from "../state/TeamState";
import { IBuzzMarker } from "../state/IBuzzMarker";
import { ITossupAnswerEvent } from "../state/Events";
import * as PlayerUtils from "../state/PlayerUtils";
import * as GameFormats from "../state/GameFormats";

/**
 * The point value of an incorrect buzz at this word. Buzzing at the end of the question never costs points. In
 * standard formats only the first neg counts, so a later buzz from another team is a no-penalty buzz; in
 * individual formats like IPNCT every player who buzzes early is penalized.
 */
export function getWrongBuzzPoints(
    cycle: Cycle,
    gameFormat: IGameFormat,
    tossup: Tossup,
    wordIndex: number,
    player: Player
): number {
    const pointsAtPosition: number = tossup.getPointsAtPosition(gameFormat, wordIndex, /* isCorrect */ false);
    if (pointsAtPosition >= 0) {
        return 0;
    }

    if (GameFormats.negsForEveryWrongBuzz(gameFormat)) {
        return pointsAtPosition;
    }

    const negBuzz: ITossupAnswerEvent | undefined = cycle.wrongBuzzes?.find((buzz) => buzz.marker.points < 0);
    return negBuzz == undefined || negBuzz.marker.player.teamName === player.teamName ? pointsAtPosition : 0;
}

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
    if (uiState.useBuzzMenu) {
        // The buzz menu opens on the clicked word; clicking the selected word again deselects it
        uiState.endBuzzPointPlacement();
        uiState.setSelectedWordIndex(uiState.selectedWordIndex === index ? -1 : index);
        uiState.showBuzzMenu(/* clearSelectedWordOnClose */ true);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // Clicking a word opens the player pad there; clicking the word the pad is already on closes it
    if (uiState.buzzPointPlacement != undefined && uiState.selectedWordIndex === index) {
        cancelBuzzPointPlacement(appState);
    } else {
        placeBuzzPointAt(appState, index, /* anchorToWord */ true);
    }

    // The click also focused the word, and a focused word gets a focus box once the keyboard is used -- which
    // looks like a second buzz point, and stays at that position when the next question shows. The buzz point and
    // the shortcuts don't need focus on the word, so let it go.
    questionWord.blur();

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
            if (appState.uiState.useBuzzMenu) {
                appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);
            } else {
                placeBuzzPointAt(appState, appState.uiState.selectedWordIndex, /* anchorToWord */ true);
            }

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

    // Don't move the buzz point out from under the user while they're placing it or marking a buzz
    if (uiState.buzzPointPlacement != undefined || uiState.buzzMenuState.visible) {
        return;
    }

    uiState.setSelectedWordIndex(wordIndex);
}

// Recognizers report words some time after they're spoken. Words recognized this soon after Space was pressed
// were most likely spoken before the buzz, so they still move the buzz point forward.
const lateWordWindowInMs = 1500;

// After the late-word window, the reader moving on this many words means reading resumed (the buzz was a false
// alarm, or it was marked some other way), so the placement is dropped
const resumedReadingWordCount = 3;

// A placement left untouched this long is stale; the next Space starts a new one instead of opening the menu
const stalePlacementInMs = 8000;

/**
 * Handles a new reading position while the buzz point is being placed with the keyboard. Words the recognizer
 * reports shortly after Space was pressed were spoken before it, so the buzz point catches up to them -- unless
 * the moderator already moved it with the arrow keys. If the reader clearly keeps reading after that, the
 * placement is dropped, so it doesn't sit on a word the reader has long passed.
 */
export function catchUpBuzzPointPlacement(appState: AppState, wordIndex: number, now: number = Date.now()): void {
    const uiState: UIState = appState.uiState;
    const placement: IBuzzPointPlacement | undefined = uiState.buzzPointPlacement;
    if (placement == undefined || wordIndex <= placement.latestLivePosition) {
        return;
    }

    if (now - placement.startTime > lateWordWindowInMs) {
        if (wordIndex >= placement.latestLivePosition + resumedReadingWordCount) {
            cancelBuzzPointPlacement(appState);
        }

        return;
    }

    uiState.setBuzzPointPlacementLatestLivePosition(wordIndex);
    const lastBuzzableIndex: number = getLastBuzzableIndex(appState);
    if (!placement.movedManually && lastBuzzableIndex >= 0) {
        uiState.setSelectedWordIndex(Math.max(0, Math.min(lastBuzzableIndex, wordIndex + placement.wordOffset)));
    }
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

/**
 * Handles the buzz shortcut (Space): places the buzz point and opens the player pad there. The arrow keys move the
 * point; a player's button (or 1-8 / Shift+1-8) records the buzz; Escape closes the pad. When the buzz menu is used
 * instead of the pad (UIState.useBuzzMenu), the second press opens the buzz menu on the placed word.
 *
 * With the microphone on, the first press always starts at the reader's position (shifted by the configured
 * offset), or the first word if nothing has been recognized yet; nothing else overrides it. Without the
 * microphone, it starts at the selected word, or the end of the question if none is selected.
 */
export function handleBuzzShortcut(appState: AppState, now?: number): void {
    const uiState: UIState = appState.uiState;
    const currentTime: number = now ?? Date.now();
    const placement: IBuzzPointPlacement | undefined = uiState.buzzPointPlacement;
    if (placement != undefined) {
        const isStale: boolean = !placement.movedManually && currentTime - placement.startTime > stalePlacementInMs;
        if (!isStale) {
            if (uiState.useBuzzMenu && !placement.startedByBuzzSound) {
                // Open the buzz menu on the placed word. Clear the word when the menu closes, so the next Space
                // follows the reader again instead of sticking to this buzz.
                uiState.showBuzzMenu(/* clearSelectedWordOnClose */ true);
            } else {
                // The pad is already open. If the buzzer opened it, the moderator's Space confirms that placement.
                uiState.confirmBuzzPointPlacement();
            }

            return;
        }

        uiState.endBuzzPointPlacement();
    }

    startBuzzPointPlacement(appState, currentTime, /* startedByBuzzSound */ false);
}

/**
 * Handles a buzzer sound heard while following the reader: places the buzz point where the reader is, as Space
 * would, so the player pad opens right away. Does nothing if a buzz is already being placed. (Buzzer detection is
 * currently turned off; see ReaderFollowerSession.)
 */
export function handleBuzzSound(appState: AppState, now?: number): void {
    const uiState: UIState = appState.uiState;
    const cycle: Cycle | undefined = appState.activeGame.cycles[uiState.cycleIndex];
    if (
        !uiState.trackReaderWithMicrophone ||
        uiState.buzzPointPlacement != undefined ||
        uiState.buzzMenuState.visible ||
        uiState.dialogState.visibleDialog !== ModalVisibilityStatus.None ||
        cycle == undefined ||
        cycle.correctBuzz != undefined
    ) {
        return;
    }

    startBuzzPointPlacement(appState, now ?? Date.now(), /* startedByBuzzSound */ true);
}

function startBuzzPointPlacement(appState: AppState, currentTime: number, startedByBuzzSound: boolean): void {
    const uiState: UIState = appState.uiState;

    const lastBuzzableIndex: number = getLastBuzzableIndex(appState);
    if (lastBuzzableIndex < 0) {
        return;
    }

    const livePosition: number = uiState.readerFollowerLivePosition;
    if (uiState.trackReaderWithMicrophone) {
        uiState.setReaderFollowerLastCue(startedByBuzzSound ? "buzz sound" : "pressed Space");
        const startPosition: number = livePosition >= 0 ? livePosition + uiState.buzzPointWordOffset : 0;
        uiState.setSelectedWordIndex(Math.max(0, Math.min(lastBuzzableIndex, startPosition)));
    } else if (uiState.selectedWordIndex < 0) {
        // Nothing selected and no reading position known; fall back to the end of the tossup
        uiState.setSelectedWordIndex(lastBuzzableIndex);
    }

    uiState.startBuzzPointPlacement({
        startTime: currentTime,
        startLivePosition: livePosition,
        latestLivePosition: livePosition,
        wordOffset: uiState.buzzPointWordOffset,
        movedManually: false,
        startedByBuzzSound,
        // Next to the buzz point, as a click opens it: at the bottom of the window it was a long way from the word
        // the reader stopped on, and the arrow keys moved a highlight the pad wasn't beside
        anchoredToWord: true,
    });
}

/**
 * Places the buzz point on the given word and opens the player pad, as a click on the word does. The reader's
 * position won't move it, since the moderator chose it. `anchorToWord` opens the pad next to the word (for a
 * click) instead of at the bottom of the window.
 */
export function placeBuzzPointAt(appState: AppState, wordIndex: number, anchorToWord: boolean, now?: number): void {
    const uiState: UIState = appState.uiState;
    const lastBuzzableIndex: number = getLastBuzzableIndex(appState);
    if (lastBuzzableIndex < 0 || wordIndex < 0) {
        return;
    }

    const livePosition: number = uiState.readerFollowerLivePosition;
    uiState.setSelectedWordIndex(Math.min(lastBuzzableIndex, wordIndex));
    uiState.startBuzzPointPlacement({
        startTime: now ?? Date.now(),
        startLivePosition: livePosition,
        latestLivePosition: livePosition,
        wordOffset: uiState.buzzPointWordOffset,
        movedManually: true,
        startedByBuzzSound: false,
        anchoredToWord: anchorToWord,
    });
}

/**
 * The E shortcut: puts the buzz point on the end of the question and opens the player pad there, or the buzz menu
 * when that's used instead.
 */
export function placeBuzzPointAtEnd(appState: AppState): void {
    const lastBuzzableIndex: number = getLastBuzzableIndex(appState);
    if (appState.uiState.useBuzzMenu) {
        if (lastBuzzableIndex >= 0) {
            appState.uiState.setSelectedWordIndex(lastBuzzableIndex);
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);
        }

        return;
    }

    placeBuzzPointAt(appState, lastBuzzableIndex, /* anchorToWord */ true);
}

/**
 * Cancels placing the buzz point (Escape), closing the player pad and clearing the selection.
 */
export function cancelBuzzPointPlacement(appState: AppState): void {
    appState.uiState.endBuzzPointPlacement();
    appState.uiState.setSelectedWordIndex(-1);
}

/**
 * Moves the buzz point to the word on the line above (direction -1) or below (direction 1), as the question is
 * laid out on the page: the word on that line closest horizontally to the current word.
 */
export function moveBuzzPointVertically(appState: AppState, direction: -1 | 1): void {
    const uiState: UIState = appState.uiState;
    if (typeof document === "undefined" || uiState.selectedWordIndex < 0) {
        return;
    }

    const elements: NodeListOf<HTMLElement> = document.querySelectorAll<HTMLElement>(".tossup span[data-index]");
    const boxes: IWordBox[] = [];
    elements.forEach((element) => {
        const index: number = parseInt(element.getAttribute("data-index") ?? "", 10);
        if (!isNaN(index)) {
            const rect: DOMRect = element.getBoundingClientRect();
            boxes.push({ index, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
        }
    });

    const target: number | undefined = findWordOnAdjacentLine(boxes, uiState.selectedWordIndex, direction);
    if (target != undefined) {
        uiState.setSelectedWordIndex(target);
        uiState.markBuzzPointPlacementMoved();
        document
            .querySelector<HTMLElement>(`.tossup span[data-index="${target}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }
}

/** Where a word is drawn on the page */
export interface IWordBox {
    index: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
}

/**
 * Finds the word on the line above (direction -1) or below (direction 1) the word with the given index that's
 * horizontally closest to it, or undefined if there's no such line.
 */
export function findWordOnAdjacentLine(boxes: IWordBox[], currentIndex: number, direction: -1 | 1): number | undefined {
    const current: IWordBox | undefined = boxes.find((box) => box.index === currentIndex);
    if (current == undefined) {
        return undefined;
    }

    const middle = (box: IWordBox): number => (box.top + box.bottom) / 2;
    const center = (box: IWordBox): number => (box.left + box.right) / 2;
    const halfHeight: number = (current.bottom - current.top) / 2;

    // Words on other lines in the requested direction
    const candidates: IWordBox[] = boxes.filter((box) =>
        direction < 0 ? middle(box) < middle(current) - halfHeight : middle(box) > middle(current) + halfHeight
    );
    if (candidates.length === 0) {
        return undefined;
    }

    // The nearest of those lines, then the word on it closest to the current word horizontally
    const lineMiddle: number =
        direction < 0
            ? Math.max(...candidates.map((box) => middle(box)))
            : Math.min(...candidates.map((box) => middle(box)));
    let best: IWordBox | undefined = undefined;
    for (const box of candidates) {
        if (Math.abs(middle(box) - lineMiddle) > halfHeight) {
            continue;
        }

        if (best == undefined || Math.abs(center(box) - center(current)) < Math.abs(center(best) - center(current))) {
            best = box;
        }
    }

    return best?.index;
}

/**
 * Moves the buzz point by `delta` buzzable words, clamped to the tossup (the Left/Right arrow keys while the
 * player pad is open).
 */
export function moveBuzzPoint(appState: AppState, delta: number): void {
    const uiState: UIState = appState.uiState;
    const tossup: Tossup | undefined = appState.activeGame.getTossup(uiState.cycleIndex);
    if (tossup == undefined) {
        return;
    }

    const lastBuzzableIndex: number =
        tossup.getWords(appState.activeGame.gameFormat).filter((word) => word.canBuzzOn).length - 1;
    if (lastBuzzableIndex < 0) {
        return;
    }

    // If nothing is selected yet, start from the end of the tossup (the buzz menu's own fallback)
    const current: number = uiState.selectedWordIndex >= 0 ? uiState.selectedWordIndex : lastBuzzableIndex;
    const next: number = Math.min(lastBuzzableIndex, Math.max(0, current + delta));
    if (next !== uiState.selectedWordIndex) {
        uiState.setSelectedWordIndex(next);
    }

    uiState.markBuzzPointPlacementMoved();
}

function getLastBuzzableIndex(appState: AppState): number {
    const tossup: Tossup | undefined = appState.activeGame.getTossup(appState.uiState.cycleIndex);
    return tossup == undefined
        ? -1
        : tossup.getWords(appState.activeGame.gameFormat).filter((word) => word.canBuzzOn).length - 1;
}

/**
 * The players in the order the player pad shows them (each team's active players in turn). The 1-8 shortcuts
 * pick from this list.
 */
export function getOrderedPlayers(appState: AppState): Player[] {
    const players: Player[] = [];
    for (const teamName of appState.activeGame.teamNames) {
        players.push(...appState.activeGame.getActivePlayers(teamName, appState.uiState.cycleIndex).values());
    }

    return players;
}

// The player pad's number keys cover this many players
export const maximumPlayerPadShortcuts = 8;

/**
 * Records a buzz from the player pad or its shortcuts (1-8 for correct, Shift+1-8 for wrong) for the player at
 * `playerIndex` in the pad's order. If the player already has that kind of buzz on this tossup, it's removed
 * instead (the pad shows it checked). Either way the pad closes. Returns whether anything changed.
 *
 * The buzz goes where the buzz point is being placed (after Space), else where the reader is (with the
 * microphone on), else on the selected word, else at the end of the question.
 */
export function recordPlayerPadBuzz(appState: AppState, playerIndex: number, isCorrect: boolean): boolean {
    const uiState: UIState = appState.uiState;
    const player: Player | undefined = getOrderedPlayers(appState)[playerIndex];
    const wordIndex: number = getPlayerPadBuzzPosition(appState);
    if (player == undefined || wordIndex < 0) {
        return false;
    }

    const before: IPlayerBuzzState = getPlayerBuzzState(appState, player);
    if (!toggleTossupBuzz(appState, player, wordIndex, isCorrect)) {
        return false;
    }

    uiState.endBuzzPointPlacement();
    uiState.setSelectedWordIndex(-1);
    uiState.setReaderFollowerLastCue(`${isCorrect ? "correct" : "wrong"} for ${player.name}`);

    // Show who got it, and how
    const after: IPlayerBuzzState = getPlayerBuzzState(appState, player);
    const isRecorded: boolean = isCorrect ? after.isCorrect : after.isWrong;
    uiState.showBuzzFeedback({
        kind: isRecorded ? (isCorrect ? "correct" : "wrong") : "removed",
        playerName: player.name,
        teamName: player.teamName,
        points: isRecorded ? after.buzzPoints : 0,
        position: isRecorded ? after.buzzPosition : before.buzzPosition,
    });
    return true;
}

/**
 * The pad index of the player the host says has the buzzer (Klaxon's buzz queue), or -1 when there isn't one or
 * they aren't in the game. A shootout can have twenty players and only eight number keys, so C and W act on
 * whoever has the buzzer instead.
 */
export function getBuzzedInPlayerIndex(appState: AppState): number {
    const buzzedIn: { name: string; teamName: string } | undefined = appState.uiState.buzzedInPlayer;
    if (buzzedIn == undefined) {
        return -1;
    }

    return getOrderedPlayers(appState).findIndex(
        (player) => player.name === buzzedIn.name && player.teamName === buzzedIn.teamName
    );
}

/** Records a correct (C) or wrong (W) buzz for the player who has the host's buzzer. */
export function recordBuzzedInPlayerBuzz(appState: AppState, isCorrect: boolean): boolean {
    const index: number = getBuzzedInPlayerIndex(appState);
    return index >= 0 ? recordPlayerPadBuzz(appState, index, isCorrect) : false;
}

/** Where a buzz recorded from the player pad goes (see recordPlayerPadBuzz), or -1 if there's no tossup. */
export function getPlayerPadBuzzPosition(appState: AppState): number {
    const uiState: UIState = appState.uiState;
    const lastBuzzableIndex: number = getLastBuzzableIndex(appState);
    if (lastBuzzableIndex < 0) {
        return -1;
    }

    if (uiState.buzzPointPlacement != undefined && uiState.selectedWordIndex >= 0) {
        return uiState.selectedWordIndex;
    }

    if (uiState.trackReaderWithMicrophone) {
        const livePosition: number = uiState.readerFollowerLivePosition;
        const position: number = livePosition >= 0 ? livePosition + uiState.buzzPointWordOffset : 0;
        return Math.max(0, Math.min(lastBuzzableIndex, position));
    }

    return uiState.selectedWordIndex >= 0 ? uiState.selectedWordIndex : lastBuzzableIndex;
}

// Adds the player's correct or wrong buzz at the word, or removes it if the player already has that kind of buzz
// on this tossup. Returns whether the buzz could be recorded.
function toggleTossupBuzz(appState: AppState, player: Player, wordIndex: number, isCorrect: boolean): boolean {
    const uiState: UIState = appState.uiState;
    const cycle: Cycle | undefined = appState.activeGame.cycles[uiState.cycleIndex];
    const tossupIndex: number = appState.activeGame.getTossupIndex(uiState.cycleIndex);
    const tossup: Tossup | undefined = appState.activeGame.packet.tossups[tossupIndex];
    if (cycle == undefined || tossup == undefined || wordIndex < 0) {
        return false;
    }

    const gameFormat: IGameFormat = appState.activeGame.gameFormat;

    const buzzState: IPlayerBuzzState = getPlayerBuzzState(appState, player);
    if (isCorrect) {
        if (buzzState.isCorrect) {
            cycle.removeCorrectBuzz();
        } else {
            // Don't include a bonus index if there should be no bonus for this correct buzz
            const bonusIndex: number | undefined =
                GameFormats.hasBonuses(gameFormat) &&
                (gameFormat.overtimeIncludesBonuses || uiState.cycleIndex < gameFormat.regulationTossupCount)
                    ? appState.activeGame.getBonusIndex(uiState.cycleIndex)
                    : undefined;

            // If we don't know the number of parts, assume it's 3, which is standard
            const partsCount: number =
                bonusIndex != undefined && appState.activeGame.packet.bonuses[bonusIndex] != undefined
                    ? appState.activeGame.packet.bonuses[bonusIndex].parts.length
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
        if (buzzState.isWrong) {
            cycle.removeWrongBuzz(player, gameFormat);
        } else {
            const words: ITossupWord[] = tossup.getWords(gameFormat);
            const lastBuzzableIndex: number = words.filter((word) => word.canBuzzOn).length - 1;
            const marker: IBuzzMarker = {
                isLastWord: wordIndex === lastBuzzableIndex,
                player,
                position: wordIndex,
                // Every wrong buzz negs in individual formats (IPNCT, a shootout); otherwise only the first neg
                // counts, and a buzz at the end of the question never does
                points: getWrongBuzzPoints(cycle, gameFormat, tossup, wordIndex, player),
            };

            cycle.addWrongBuzz(marker, tossupIndex, gameFormat);
        }
    }

    return true;
}

/** What a player has done on the current tossup, as the player pad shows it */
export interface IPlayerBuzzState {
    isCorrect: boolean;
    isWrong: boolean;

    /** The word of the player's buzz on this tossup, or -1 if they haven't buzzed */
    buzzPosition: number;

    /** The points the player's buzz scored (negative for a neg), or 0 if they haven't buzzed */
    buzzPoints: number;

    /** Whether the player's team has protested this tossup */
    hasProtest: boolean;
}

export function getPlayerBuzzState(appState: AppState, player: Player): IPlayerBuzzState {
    const uiState: UIState = appState.uiState;
    const cycle: Cycle | undefined = appState.activeGame.cycles[uiState.cycleIndex];
    const tossupIndex: number = appState.activeGame.getTossupIndex(uiState.cycleIndex);
    if (cycle == undefined) {
        return { isCorrect: false, isWrong: false, buzzPosition: -1, buzzPoints: 0, hasProtest: false };
    }

    const correctBuzz: ITossupAnswerEvent | undefined =
        cycle.correctBuzz != undefined && PlayerUtils.playersEqual(cycle.correctBuzz.marker.player, player)
            ? cycle.correctBuzz
            : undefined;
    const wrongBuzz: ITossupAnswerEvent | undefined = cycle.wrongBuzzes?.find(
        (buzz) => buzz.tossupIndex === tossupIndex && PlayerUtils.playersEqual(buzz.marker.player, player)
    );
    return {
        isCorrect: correctBuzz != undefined,
        isWrong: wrongBuzz != undefined,
        buzzPosition: (correctBuzz ?? wrongBuzz)?.marker.position ?? -1,
        buzzPoints: (correctBuzz ?? wrongBuzz)?.marker.points ?? 0,
        hasProtest:
            cycle.tossupProtests != undefined &&
            cycle.tossupProtests.some((protest) => protest.teamName === player.teamName),
    };
}

/**
 * Starts (or, if the team already protested, offers to remove) a protest of the player's buzz on this tossup,
 * from the player pad. Only players who buzzed can protest. Closes the pad.
 */
export function togglePlayerPadProtest(appState: AppState, playerIndex: number): void {
    const uiState: UIState = appState.uiState;
    const player: Player | undefined = getOrderedPlayers(appState)[playerIndex];
    const cycle: Cycle | undefined = appState.activeGame.cycles[uiState.cycleIndex];
    if (player == undefined || cycle == undefined) {
        return;
    }

    const buzzState: IPlayerBuzzState = getPlayerBuzzState(appState, player);
    if (buzzState.buzzPosition < 0) {
        return;
    }

    cancelBuzzPointPlacement(appState);
    if (buzzState.hasProtest) {
        uiState.showRemoveTossupProtestDialog(cycle, player.teamName);
    } else {
        uiState.setPendingTossupProtest(
            player.teamName,
            appState.activeGame.getTossupIndex(uiState.cycleIndex),
            buzzState.buzzPosition
        );
    }
}

/**
 * The players shown in the buzz menu, in display order (each team's active players in turn). Number keys pick
 * from this list.
 */
export function getBuzzMenuOrderedPlayers(appState: AppState): Player[] {
    const players: Player[] = [];
    for (const teamName of appState.activeGame.teamNames) {
        players.push(...appState.activeGame.getActivePlayers(teamName, appState.uiState.cycleIndex).values());
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
    const cycle: Cycle | undefined = appState.activeGame.cycles[uiState.cycleIndex];
    const tossupIndex: number = appState.activeGame.getTossupIndex(uiState.cycleIndex);
    const tossup: Tossup | undefined = appState.activeGame.packet.tossups[tossupIndex];
    const wordIndex: number = uiState.selectedWordIndex;
    if (player == undefined || cycle == undefined || tossup == undefined || wordIndex < 0) {
        return;
    }

    const gameFormat: IGameFormat = appState.activeGame.gameFormat;

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
                GameFormats.hasBonuses(gameFormat) &&
                (gameFormat.overtimeIncludesBonuses || uiState.cycleIndex < gameFormat.regulationTossupCount)
                    ? appState.activeGame.getBonusIndex(uiState.cycleIndex)
                    : undefined;

            // If we don't know the number of parts, assume it's 3, which is standard
            const partsCount: number =
                bonusIndex != undefined && appState.activeGame.packet.bonuses[bonusIndex] != undefined
                    ? appState.activeGame.packet.bonuses[bonusIndex].parts.length
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
                points: getWrongBuzzPoints(cycle, gameFormat, tossup, wordIndex, player),
            };

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
    const cycleIndex: number = appState.activeGame.cycles.indexOf(cycle);
    const { message, replacementIndex, defaultReplacementIsExplicit } = getThrowOutQuestionPrompt(
        appState,
        cycleIndex,
        "tossup",
        tossupNumber
    );
    const totalTossups: number = appState.activeGame.packet.tossups.length;
    appState.uiState.dialogState.showThrowOutQuestionDialog({
        title: "Throw Out Tossup",
        message:
            `${message} To undo this, click on the X next to its event in the Event Log.` +
            (onThrownOut ? " If the packet runs out of tossups, the next tiebreaker question is added automatically." : ""),
        minQuestionNumber: tossupNumber + 1,
        defaultReplacementIsExplicit,
        defaultReplacementNumber: replacementIndex != undefined ? replacementIndex + 1 : undefined,
        maxQuestionNumber: totalTossups,
        onConfirm: (userReplacementIndex) => {
            onConfirmThrowOutTossup(appState, cycle, tossupNumber, userReplacementIndex);
            if (onThrownOut) {
                onThrownOut();
            }
        },
    });
}

function onConfirmThrowOutTossup(
    appState: AppState,
    cycle: Cycle,
    tossupNumber: number,
    replacementIndex: number | undefined
) {
    cycle.addThrownOutTossup(tossupNumber - 1, replacementIndex);
    appState.uiState.setSelectedWordIndex(-1);
}
