import * as React from "react";
import { observer } from "mobx-react-lite";
import { FocusZone, FocusZoneDirection, mergeStyleSets } from "@fluentui/react";

import * as TossupQuestionController from "./TossupQuestionController";
import { UIState } from "../state/UIState";
import { ITossupWord, Tossup } from "../state/PacketState";
import { QuestionWord } from "./QuestionWord";
import { Cycle } from "../state/Cycle";
import { BuzzMenu } from "./BuzzMenu";
import { Answer } from "./Answer";
import { IFormattedText } from "../parser/IFormattedText";
import { TossupProtestDialog } from "./dialogs/TossupProtestDialog";
import { CancelButton } from "./CancelButton";
import { AppState } from "../state/AppState";
import { PostQuestionMetadata } from "./PostQuestionMetadata";
import { BuzzSoundDetector } from "../speech/BuzzSoundDetector";
import { ReaderFollower } from "../speech/ReaderFollower";
import { ReaderFollowerDebug } from "./ReaderFollowerDebug";

// How long the reading has to pause (no new matched words) before the buzz point moves to the reader's position.
// Speech recognizers emit words in bursts while someone is talking, so this also smooths out mid-sentence jitter.
const readerPauseDelayInMs = 500;

export const TossupQuestion = observer(function TossupQuestion(props: IQuestionProps): JSX.Element {
    const classes: ITossupQuestionClassNames = getClassNames();

    const selectedWordRef: React.MutableRefObject<null> = React.useRef(null);
    const tossupTextRef: React.MutableRefObject<HTMLDivElement | null> = React.useRef(null);
    const [lastTossup, setLastTossup] = React.useState(props.tossup);

    if (lastTossup !== props.tossup) {
        setLastTossup(props.tossup);
        if (tossupTextRef.current != null) {
            // Reset the scrollbar to go back to the top so they can read from the beginning
            tossupTextRef.current.scrollTop = 0;
        }
    }

    // Follow the reader with the microphone, if it's enabled. Once there's a correct buzz the tossup is over (the
    // reader moves on to the bonus), so stop listening then. Wrong buzzes keep the tossup live, so keep following.
    const isReaderFollowingEnabled: boolean = props.appState.uiState.trackReaderWithMicrophone;
    const isTossupOver: boolean = props.cycle.correctBuzz != undefined;
    const gameFormat = props.appState.game.gameFormat;
    React.useEffect(() => {
        if (!isReaderFollowingEnabled || isTossupOver) {
            return;
        }

        // While the reader is actively speaking, position updates stream in constantly, and moving the highlight
        // word-by-word is distracting. Only move the buzz point once updates pause (the reader stopped because
        // someone buzzed, or paused at the end of a clue). A buzzer sound or a buzz resolution word ("correct",
        // "neg") means a buzz definitely happened, so those move it immediately.
        let latestWordIndex = -1;
        let pauseTimerId: number | undefined = undefined;
        const clearPauseTimer = (): void => {
            if (pauseTimerId != undefined) {
                window.clearTimeout(pauseTimerId);
                pauseTimerId = undefined;
            }
        };

        // When this is on, the reader follower never moves the highlight on its own; the live position is still
        // tracked so pressing B can jump to it. Read fresh each call so toggling it doesn't restart the mic.
        const holdHighlightUntilBuzz = (): boolean => props.appState.uiState.holdReaderHighlightUntilBuzz;

        const flushBuzzPoint = (cue: string): void => {
            clearPauseTimer();
            TossupQuestionController.updateReaderFollowerCue(props.appState, cue);
            if (latestWordIndex >= 0 && !holdHighlightUntilBuzz()) {
                TossupQuestionController.updateBuzzPointFromReader(props.appState, latestWordIndex);
            }
        };

        const onPositionChanged = (wordIndex: number): void => {
            latestWordIndex = wordIndex;
            TossupQuestionController.updateReaderFollowerLivePosition(props.appState, wordIndex);

            clearPauseTimer();
            if (holdHighlightUntilBuzz()) {
                return;
            }

            pauseTimerId = window.setTimeout(() => {
                pauseTimerId = undefined;
                TossupQuestionController.updateBuzzPointFromReader(props.appState, latestWordIndex);
            }, readerPauseDelayInMs);
        };

        const follower: ReaderFollower = new ReaderFollower({
            onPositionChanged,
            onPermanentError: (message) => TossupQuestionController.onReaderFollowerError(props.appState, message),
            onBuzzResolutionWord: (word) => flushBuzzPoint(`heard "${word}"`),
            onStatusChanged: (engine, status) =>
                TossupQuestionController.updateReaderFollowerStatus(props.appState, engine, status),
            onTranscript: (transcript) =>
                TossupQuestionController.updateReaderFollowerTranscript(props.appState, transcript),
        });
        follower.start(TossupQuestionController.getWordsForReaderFollower(props.tossup, gameFormat));

        const buzzSoundDetector: BuzzSoundDetector | undefined = BuzzSoundDetector.isSupported()
            ? new BuzzSoundDetector(() => flushBuzzPoint("buzz sound"))
            : undefined;
        buzzSoundDetector?.start();

        return () => {
            clearPauseTimer();
            follower.stop();
            buzzSoundDetector?.stop();
        };
    }, [props.appState, props.tossup, gameFormat, isReaderFollowingEnabled, isTossupOver]);

    const disableThrowOutButton: boolean = props.appState.game.cycles.some(
        (cycle) => cycle.orderedBuzzes.length > 0 && cycle.orderedBuzzes[0].tossupIndex + 1 > props.tossupNumber
    );
    const throwOutButtonTooltip: string = disableThrowOutButton
        ? "Cannot throw out tossup if future tossups have events"
        : "Throw out tossup";

    const correctBuzzIndex: number = props.cycle.correctBuzz?.marker.position ?? -1;
    const wrongBuzzIndexes: number[] = (props.cycle.wrongBuzzes ?? [])
        .filter((buzz) => buzz.tossupIndex === props.tossupNumber - 1)
        .map((buzz) => buzz.marker.position);

    const words: ITossupWord[] = props.tossup.getWords(props.appState.game.gameFormat);

    let questionWords: JSX.Element[] = [<span key="tuNumber">{props.tossupNumber}. </span>];

    questionWords = questionWords.concat(
        words.map((word) => (
            <QuestionWordWrapper
                key={word.canBuzzOn ? `qw_${word.wordIndex}` : `nqw_${word.nonWordIndex}`}
                correctBuzzIndex={correctBuzzIndex}
                index={word.canBuzzOn ? word.wordIndex : undefined}
                isLastWord={word.canBuzzOn && word.isLastWord}
                selectedWordRef={selectedWordRef}
                word={word.word}
                wrongBuzzIndexes={wrongBuzzIndexes}
                {...props}
            />
        ))
    );

    const throwOutClickHandler: () => void = () => {
        TossupQuestionController.throwOutTossup(props.appState, props.cycle, props.tossupNumber);
    };
    const selectWordFromClickHandler = React.useCallback(
        (event: React.MouseEvent<HTMLDivElement>) =>
            TossupQuestionController.selectWordFromClick(props.appState, event),
        [props.appState]
    );
    const mouseMoveHandler = React.useCallback(
        () => props.appState.uiState.setLastQuestionTextMouseMoveTime(Date.now()),
        [props.appState]
    );

    // Need tossuptext/answer in one container, X in the other
    return (
        <div className={classes.tossupContainer}>
            <TossupProtestDialog appState={props.appState} cycle={props.cycle} />
            <div ref={tossupTextRef}>
                <FocusZone
                    as="div"
                    className={classes.tossupQuestionText}
                    shouldRaiseClicks={true}
                    direction={FocusZoneDirection.bidirectional}
                    onClick={selectWordFromClickHandler}
                    onDoubleClick={selectWordFromClickHandler}
                    onMouseMove={mouseMoveHandler}
                >
                    {questionWords}
                </FocusZone>
                <Answer text={props.tossup.answer} />
                <PostQuestionMetadata metadata={props.tossup.metadata} />
                <ReaderFollowerDebug appState={props.appState} />
            </div>
            <div>
                <CancelButton
                    disabled={disableThrowOutButton}
                    tooltip={throwOutButtonTooltip}
                    onClick={throwOutClickHandler}
                />
            </div>
        </div>
    );
});

// We need to use a wrapper component so we can give it a key. Otherwise, React will complain
const QuestionWordWrapper = observer(function QuestionWordWrapper(props: IQuestionWordWrapperProps) {
    const uiState: UIState = props.appState.uiState;
    const selected: boolean = props.index === uiState.selectedWordIndex;

    const buzzMenu: JSX.Element | undefined =
        selected && props.index != undefined && uiState.buzzMenuState.visible ? (
            <BuzzMenu
                appState={props.appState}
                bonusIndex={props.bonusIndex}
                cycle={props.cycle}
                isLastWord={props.isLastWord}
                wordIndex={props.index}
                target={props.selectedWordRef}
                tossup={props.tossup}
                tossupNumber={props.tossupNumber}
            />
        ) : undefined;

    return (
        <>
            <QuestionWord
                index={props.index}
                word={props.word}
                selected={props.index === uiState.selectedWordIndex}
                correct={props.index === props.correctBuzzIndex}
                wrong={props.wrongBuzzIndexes.findIndex((position) => position === props.index) >= 0}
                componentRef={selected ? props.selectedWordRef : undefined}
            />
            {buzzMenu}
            &nbsp;
        </>
    );
});

export interface IQuestionProps {
    appState: AppState;
    bonusIndex: number;
    cycle: Cycle;
    tossup: Tossup;
    tossupNumber: number;
}

interface IQuestionWordWrapperProps {
    appState: AppState;
    bonusIndex: number;
    correctBuzzIndex: number;
    cycle: Cycle;
    index?: number;
    isLastWord: boolean;
    selectedWordRef: React.MutableRefObject<null>;
    tossup: Tossup;
    tossupNumber: number;
    word: IFormattedText[];
    wrongBuzzIndexes: number[];
}

interface ITossupQuestionClassNames {
    tossupContainer: string;
    tossupQuestionText: string;
}

const getClassNames = (): ITossupQuestionClassNames =>
    mergeStyleSets({
        tossupContainer: {
            paddingLeft: "24px",
            display: "flex",
            justifyContent: "space-between",
        },
        tossupQuestionText: {
            display: "inline-block",
            marginBottom: "0.5em",
        },
    });
