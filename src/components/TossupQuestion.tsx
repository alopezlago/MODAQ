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
import { CancelButton, ICancelButtonPrompt } from "./CancelButton";
import { AppState } from "../state/AppState";
import { PostQuestionMetadata } from "./PostQuestionMetadata";

const throwOutQuestionPrompt: ICancelButtonPrompt = {
    title: "Throw out Tossup",
    message: "Click OK to throw out the tossup. To undo this, click on the X next to its event in the Event Log.",
};

export const TossupQuestion = observer(function TossupQuestion(props: IQuestionProps): JSX.Element {
    const classes: ITossupQuestionClassNames = getClassNames();

    const selectedWordRef: React.MutableRefObject<null> = React.useRef(null);

    const correctBuzzIndex: number = props.cycle.correctBuzz?.marker.position ?? -1;
    const wrongBuzzIndexes: number[] = (props.cycle.wrongBuzzes ?? [])
        .filter((buzz) => buzz.tossupIndex === props.tossupNumber - 1)
        .map((buzz) => buzz.marker.position);

    const words: ITossupWord[] = props.tossup.getWords(props.appState.game.gameFormat);

    const questionWords: JSX.Element[] = words.map((word) => (
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
    ));

    const wordClickHandler: React.MouseEventHandler = React.useCallback(
        (event: React.MouseEvent<HTMLDivElement>): void => {
            TossupQuestionController.selectWordFromClick(props.appState, event);
        },
        [props]
    );
    const throwOutClickHandler: () => void = React.useCallback(() => {
        TossupQuestionController.throwOutTossup(props.appState, props.cycle, props.tossupNumber);
    }, [props]);

    // Need tossuptext/answer in one container, X in the other
    return (
        <div className={classes.tossupContainer}>
            <TossupProtestDialog appState={props.appState} cycle={props.cycle} />
            <div className={classes.tossupText}>
                <FocusZone
                    as="div"
                    className={classes.tossupQuestionText}
                    shouldRaiseClicks={true}
                    direction={FocusZoneDirection.bidirectional}
                    onClick={wordClickHandler}
                    onDoubleClick={wordClickHandler}
                >
                    {questionWords}
                </FocusZone>
                <Answer text={props.tossup.answer} />
                <PostQuestionMetadata metadata={props.tossup.metadata} />
            </div>
            <div>
                <CancelButton
                    prompt={throwOutQuestionPrompt}
                    tooltip="Throw out tossup"
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
    tossupText: string;
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
            marginBottom: "0.25em",
        },
        tossupText: {
            maxHeight: "37.5vh",
            overflowY: "auto",
        },
    });
