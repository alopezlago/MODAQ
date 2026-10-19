import * as TossupQuestionController from "./TossupQuestionController";
import { AppState } from "../state/AppState";
import { IGameFormat } from "../state/IGameFormat";
import { Bonus, Tossup } from "../state/PacketState";
import * as FormattedTextParser from "../parser/FormattedTextParser";
import * as RoundTiming from "../scorecard/RoundTiming";
import { BuzzSoundDetector } from "../speech/BuzzSoundDetector";
import { ReaderFollower } from "../speech/ReaderFollower";

// Buzzer sound detection is off for now: it mistook speech for buzzers often enough to keep opening the player
// pad while the reader was reading. It also opens a second capture of the microphone, which some browsers handle
// poorly. Set this to true to turn it back on.
const buzzSoundDetectionEnabled = false;

// How long the reading has to pause (no new matched words) before the buzz point moves to the reader's position.
// Speech recognizers emit words in bursts while someone is talking, so this also smooths out mid-sentence jitter.
const readerPauseDelayInMs = 500;

/**
 * Microphone tracking for a game: listens continuously while it's enabled, follows whichever tossup is being
 * read, and moves the buzz point to where the reader is.
 *
 * Listening isn't restarted between tossups. Speech recognizers take a moment to start, and restarting for each
 * question would lose its first words.
 */
export class ReaderFollowerSession {
    private readonly appState: AppState;

    private readonly follower: ReaderFollower;

    private buzzSoundDetector: BuzzSoundDetector | undefined;

    private latestWordIndex: number;

    private pauseTimerId: number | undefined;

    // The words being followed, joined, so the same tossup handed over again isn't restarted (see setTossup)
    private targetKey: string | undefined;

    // Following a bonus only to time it for the scorecard (see setBonus): positions are recorded, never shown
    private followingBonus: boolean;

    constructor(appState: AppState) {
        this.appState = appState;
        this.latestWordIndex = -1;
        this.pauseTimerId = undefined;
        this.followingBonus = false;

        this.follower = new ReaderFollower({
            onPositionChanged: (wordIndex) => this.onPositionChanged(wordIndex),
            onPermanentError: (message) => TossupQuestionController.onReaderFollowerError(appState, message),
            onBuzzResolutionWord: (word) => {
                RoundTiming.recordRulingHeard();
                if (!this.followingBonus) {
                    this.flushBuzzPoint(`heard "${word}"`);
                }
            },
            onStatusChanged: (engine, status) =>
                TossupQuestionController.updateReaderFollowerStatus(appState, engine, status),
            onTranscript: (transcript) => TossupQuestionController.updateReaderFollowerTranscript(appState, transcript),
            onAudioCaptureError: () => this.stopBuzzSoundDetector(),
        });
        this.follower.start();

        // A buzzer sound means a buzz definitely happened, so the buzz point should catch up immediately
        this.buzzSoundDetector =
            buzzSoundDetectionEnabled && BuzzSoundDetector.isSupported()
                ? new BuzzSoundDetector(() => this.onBuzzSound())
                : undefined;
        this.buzzSoundDetector?.start();
    }

    /**
     * Follows the given tossup from its beginning, or nothing if it's undefined (e.g. once the tossup has been
     * answered correctly and the reader moves on to the bonus).
     */
    public setTossup(tossup: Tossup | undefined, gameFormat: IGameFormat): void {
        const words: string[] | undefined =
            tossup == undefined ? undefined : TossupQuestionController.getWordsForReaderFollower(tossup, gameFormat);

        // The same question again isn't a new one. A game applied from another screen (a co-reader's change)
        // rebuilds the packet, so the tossup arrives as a new object mid-reading; starting over from its first word
        // then left Space on word 1 until the reader began a new sentence.
        const key: string | undefined = words?.join("\n");
        if (key != undefined && key === this.targetKey) {
            return;
        }

        this.targetKey = key;
        this.followingBonus = false;
        this.clearPauseTimer();
        this.latestWordIndex = -1;
        TossupQuestionController.updateReaderFollowerLivePosition(this.appState, -1);
        this.follower.setTargetWords(words);
        if (words != undefined) {
            RoundTiming.recordTossupWords(words);
        }
    }

    /**
     * Experimental (moderator scorecard): follows the bonus being read, only to time it -- when each part was
     * finished and how long the team was given before the reader went on. Nothing on screen moves.
     */
    public setBonus(bonus: Bonus, gameFormat: IGameFormat): void {
        const wordsOf = (text: string): string[] =>
            FormattedTextParser.splitFormattedTextIntoWords(text, {
                pronunciationGuideMarkers: gameFormat.pronunciationGuideMarkers,
            })
                .filter((word) => word.length > 0 && word[0].pronunciation !== true)
                .map((word) => word.map((segment) => segment.text).join("").trim())
                // "[10]" is read as "for ten points", if at all
                .filter((word) => word.length > 0 && !/^\[\d+[a-z]?\]$/i.test(word));

        const leadin: string[] = wordsOf(bonus.leadin);
        const parts: string[][] = bonus.parts.map((part) => wordsOf(part.question));
        const words: string[] = leadin.concat(...parts);
        const key: string = "bonus\n" + words.join("\n");
        if (key === this.targetKey) {
            return;
        }

        this.targetKey = key;
        this.followingBonus = true;
        this.clearPauseTimer();
        this.latestWordIndex = -1;
        TossupQuestionController.updateReaderFollowerLivePosition(this.appState, -1);
        this.follower.setTargetWords(words);
        RoundTiming.recordBonusWords(
            leadin.length,
            parts.map((part) => part.length)
        );
    }

    public dispose(): void {
        this.clearPauseTimer();
        this.follower.stop();
        this.buzzSoundDetector?.stop();
    }

    // The buzz sound detector opens its own capture of the microphone, separate from the speech recognizer's.
    // Some browsers (Safari, especially on iOS) can't run both, and recognition fails to capture audio. Following
    // the reader matters more than hearing the buzzer, so give up buzz sound detection if that happens.
    private stopBuzzSoundDetector(): void {
        if (this.buzzSoundDetector != undefined) {
            this.buzzSoundDetector.stop();
            this.buzzSoundDetector = undefined;
            TossupQuestionController.updateReaderFollowerCue(
                this.appState,
                "buzz sound detection turned off (the microphone couldn't be shared)"
            );
        }
    }

    // When the reader's position is shown while they read, position updates stream in constantly, and moving the
    // highlight word-by-word is distracting. By default the highlight only moves once updates pause (the reader stopped
    // because someone buzzed, or paused at the end of a clue). A buzzer sound or a buzz resolution word ("correct",
    // "neg") means a buzz definitely happened, so those move it immediately.
    private onPositionChanged(wordIndex: number): void {
        if (this.followingBonus) {
            RoundTiming.recordReaderPosition("bonus", wordIndex);
            return;
        }

        RoundTiming.recordReaderPosition("tossup", wordIndex);
        this.latestWordIndex = wordIndex;
        TossupQuestionController.updateReaderFollowerLivePosition(this.appState, wordIndex);

        this.clearPauseTimer();

        // Words recognized just after Space was pressed were spoken before it; let the buzz point catch up
        if (this.appState.uiState.buzzPointPlacement != undefined) {
            TossupQuestionController.catchUpBuzzPointPlacement(this.appState, wordIndex);
            return;
        }

        // By default the reader's position isn't shown while they read; it's tracked so pressing Space can jump to
        // it. A retracted position (-1) doesn't move the highlight either.
        if (!this.appState.uiState.showReaderPositionWhileReading || wordIndex < 0) {
            return;
        }

        if (this.appState.uiState.instantReaderHighlight) {
            TossupQuestionController.updateBuzzPointFromReader(this.appState, wordIndex);
            return;
        }

        this.pauseTimerId = window.setTimeout(() => {
            this.pauseTimerId = undefined;
            TossupQuestionController.updateBuzzPointFromReader(this.appState, this.latestWordIndex);
        }, readerPauseDelayInMs);
    }

    // A buzzer sound means a buzz just happened: place the buzz point where the reader is and open the player pad
    private onBuzzSound(): void {
        this.flushBuzzPoint("buzz sound");
        TossupQuestionController.handleBuzzSound(this.appState);
    }

    private flushBuzzPoint(cue: string): void {
        this.clearPauseTimer();
        TossupQuestionController.updateReaderFollowerCue(this.appState, cue);
        if (this.latestWordIndex >= 0 && this.appState.uiState.showReaderPositionWhileReading) {
            TossupQuestionController.updateBuzzPointFromReader(this.appState, this.latestWordIndex);
        }
    }

    private clearPauseTimer(): void {
        if (this.pauseTimerId != undefined) {
            window.clearTimeout(this.pauseTimerId);
            this.pauseTimerId = undefined;
        }
    }
}
