import * as React from "react";
import { observer } from "mobx-react-lite";
import { FocusZone, FocusZoneDirection, mergeStyleSets } from "@fluentui/react";

import * as TossupQuestionController from "./TossupQuestionController";
import { IBuzzFeedback } from "../state/IBuzzFeedback";
import { UIState } from "../state/UIState";
import { ITossupWord, Tossup } from "../state/PacketState";
import { QuestionWord } from "./QuestionWord";
import { BuzzMenu } from "./BuzzMenu";
import { Cycle } from "../state/Cycle";
import { Answer } from "./Answer";
import type { IFormattedText } from "../parser/IFormattedText";
import { TossupProtestDialog } from "./dialogs/TossupProtestDialog";
import { CancelButton } from "./CancelButton";
import { AppState } from "../state/AppState";
import { PostQuestionMetadata } from "./PostQuestionMetadata";
import { IGameFormat } from "../state/IGameFormat";
import { BuzzFeedback } from "./BuzzFeedback";
import { PlayerPad } from "./PlayerPad";
import { ReaderFollowerDebug } from "./ReaderFollowerDebug";
import { ReaderFollowerIndicator } from "./ReaderFollowerIndicator";
import { ReaderFollowerSession } from "./ReaderFollowerSession";

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

            // The new question's words reuse the old ones' elements by position, so a word that had keyboard focus
            // would show its focus box on the same spot in the new question
            const focusedElement: Element | null = document.activeElement;
            if (focusedElement instanceof HTMLElement && tossupTextRef.current.contains(focusedElement)) {
                focusedElement.blur();
            }
        }
    }

    // Follow the reader with the microphone, if it's enabled. Listening starts when the feature is turned on and
    // keeps running from tossup to tossup; only the words being followed change.
    const isReaderFollowingEnabled: boolean = props.appState.uiState.trackReaderWithMicrophone;
    const readerFollowerRestartCount: number = props.appState.uiState.readerFollowerRestartCount;
    const readerFollowerSessionRef: React.MutableRefObject<ReaderFollowerSession | undefined> = React.useRef();
    React.useEffect(() => {
        if (!isReaderFollowingEnabled) {
            return;
        }

        const session: ReaderFollowerSession = new ReaderFollowerSession(props.appState);
        readerFollowerSessionRef.current = session;
        return () => {
            readerFollowerSessionRef.current = undefined;
            session.dispose();
        };
    }, [props.appState, isReaderFollowingEnabled, readerFollowerRestartCount]);

    // Once there's a correct buzz the tossup is over (the reader moves on to the bonus), so stop following it.
    // Wrong buzzes keep the tossup live, so keep following.
    const isTossupOver: boolean = props.cycle.correctBuzz != undefined;
    const gameFormat: IGameFormat = props.appState.activeGame.gameFormat;
    React.useEffect(() => {
        readerFollowerSessionRef.current?.setTossup(isTossupOver ? undefined : props.tossup, gameFormat);
    }, [props.tossup, gameFormat, isReaderFollowingEnabled, isTossupOver, readerFollowerRestartCount]);

    const correctBuzzIndex: number = props.cycle.correctBuzz?.marker.position ?? -1;
    const wrongBuzzIndexes: number[] = (props.cycle.wrongBuzzes ?? [])
        .filter((buzz) => buzz.tossupIndex === props.tossupNumber - 1)
        .map((buzz) => buzz.marker.position);

    const words: ITossupWord[] = props.tossup.getWords(props.appState.activeGame.gameFormat);

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

    // While the buzz point is being placed, keyboard focus sits on its word, so the arrow keys move it through the
    // question's FocusZone (which knows how the words are laid out, up and down lines included) and the buzz point
    // follows. When placing ends the word lets go of focus, or its focus box would look like a second buzz point.
    const uiState: UIState = props.appState.uiState;
    const placingWordIndex: number = uiState.buzzPointPlacement != undefined ? uiState.selectedWordIndex : -1;
    const wasPlacingRef: React.MutableRefObject<boolean> = React.useRef(false);
    React.useEffect(() => {
        const text: HTMLDivElement | null = tossupTextRef.current;
        if (text == null) {
            return;
        }

        if (placingWordIndex < 0) {
            const focusedElement: Element | null = document.activeElement;
            if (wasPlacingRef.current && focusedElement instanceof HTMLElement && text.contains(focusedElement)) {
                focusedElement.blur();
            }

            wasPlacingRef.current = false;
            return;
        }

        wasPlacingRef.current = true;
        const word: HTMLElement | null = text.querySelector<HTMLElement>(`span[data-index="${placingWordIndex}"]`);
        if (word != null && document.activeElement !== word) {
            word.focus({ preventScroll: true });
            word.scrollIntoView({ block: "nearest" });
        }
    }, [placingWordIndex]);

    // Only keyboard focus (the arrow keys) moves the buzz point. Clicking a word focuses it too, but the click itself
    // is handled by selectWordFromClick; moving the buzz point on its focus first would make that click land on the
    // buzz point's own word, which closes the pad.
    const activeWordChangedHandler = React.useCallback(
        (element?: HTMLElement) => {
            if (element == undefined || !isKeyboardFocus(element)) {
                return;
            }

            const index: number | undefined = TossupQuestionController.wordIndexFromClickTarget(element);
            if (index != undefined) {
                TossupQuestionController.moveBuzzPointTo(props.appState, index);
            }
        },
        [props.appState]
    );

    const throwOutClickHandler: () => void = () => {
        TossupQuestionController.throwOutTossup(props.appState, props.cycle, props.tossupNumber);
    };
    const selectWordFromClickHandler = React.useCallback(
        (event: React.MouseEvent<HTMLDivElement>) =>
            TossupQuestionController.selectWordFromClick(props.appState, event),
        [props.appState]
    );

    // Need tossuptext/answer in one container, X in the other
    return (
        <div className={`${classes.tossupContainer} tossup`}>
            <TossupProtestDialog appState={props.appState} cycle={props.cycle} />
            <div ref={tossupTextRef}>
                {/* Space is the buzz shortcut, so it doesn't click the focused word; Enter still does */}
                <FocusZone
                    as="div"
                    className={classes.tossupQuestionText}
                    shouldRaiseClicks={true}
                    shouldRaiseClicksOnSpace={false}
                    direction={FocusZoneDirection.bidirectional}
                    onActiveElementChanged={activeWordChangedHandler}
                    onClick={selectWordFromClickHandler}
                    onDoubleClick={selectWordFromClickHandler}
                >
                    {questionWords}
                </FocusZone>
                <Answer text={props.tossup.answer} />
                <PostQuestionMetadata metadata={props.tossup.metadata} />
                <PlayerPad appState={props.appState} tossup={props.tossup} />
                <BuzzFeedback appState={props.appState} />
                <ReaderFollowerDebug appState={props.appState} />
            </div>
            <div className={classes.sideButtons}>
                <CancelButton
                    className="throw-out-tossup"
                    tooltip="Throw out tossup"
                    onClick={throwOutClickHandler}
                />
                <ReaderFollowerIndicator uiState={props.appState.uiState} />
            </div>
        </div>
    );
});

// The browser's own call (:focus-visible): true for focus moved by the keyboard, false for a mouse click
function isKeyboardFocus(element: HTMLElement): boolean {
    try {
        return element.matches(":focus-visible");
    } catch {
        // A browser too old to know :focus-visible; the arrow keys still move focus, just not the buzz point
        return false;
    }
}

// We need to use a wrapper component so we can give it a key. Otherwise, React will complain
const QuestionWordWrapper = observer(function QuestionWordWrapper(props: IQuestionWordWrapperProps) {
    const uiState: UIState = props.appState.uiState;
    const selected: boolean = props.index === uiState.selectedWordIndex;
    const buzzFeedback: IBuzzFeedback | undefined = uiState.buzzFeedback;

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
                placing={selected && uiState.buzzPointPlacement != undefined}
                flash={buzzFeedback != undefined && buzzFeedback.position === props.index ? buzzFeedback.kind : undefined}
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
    sideButtons: string;
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
        // The throw-out button, with the microphone indicator under it when follow-along is on
        sideButtons: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
        },
    });
