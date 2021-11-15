import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets } from "@fluentui/react";

import * as TossupQuestionController from "./TossupQuestionController";
import { UIState } from "src/state/UIState";
import { ITossupWord, Tossup } from "src/state/PacketState";
import { QuestionWord } from "./QuestionWord";
import { Cycle } from "src/state/Cycle";
import { BuzzMenu } from "./BuzzMenu";
import { Answer } from "./Answer";
import { IFormattedText } from "src/parser/IFormattedText";
import { TossupProtestDialog } from "./dialogs/TossupProtestDialog";
import { CancelButton, ICancelButtonPrompt } from "./CancelButton";
import { AppState } from "src/state/AppState";
import { PostQuestionMetadata } from "./PostQuestionMetadata";

const throwOutQuestionPrompt: ICancelButtonPrompt = {
    title: "Throw out Tossup",
    message: "Click OK to throw out the tossup. To undo this, click on the X next to its event in the Event Log.",
};

export const TossupQuestion = observer(
    (props: IQuestionProps): JSX.Element => {
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

        const containerKeyDownHandler: React.KeyboardEventHandler<HTMLDivElement> = React.useCallback(
            (event: React.KeyboardEvent<HTMLDivElement>) => onKeyDown(event, props.appState),
            [props]
        );

        // Need tossuptext/answer in one container, X in the other
        return (
            <div className={classes.tossupContainer}>
                <TossupProtestDialog appState={props.appState} cycle={props.cycle} />
                <div className={classes.tossupText} tabIndex={0} onKeyDown={containerKeyDownHandler}>
                    <div
                        className={classes.tossupQuestionText}
                        onClick={wordClickHandler}
                        onDoubleClick={wordClickHandler}
                    >
                        {questionWords}
                    </div>
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
    }
);

// We need to use a wrapper component so we can give it a key. Otherwise, React will complain
const QuestionWordWrapper = observer((props: IQuestionWordWrapperProps) => {
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

function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>, appState: AppState): void {
    switch (event.key) {
        case "ArrowLeft":
            const previousWordIndex: number = Math.max(0, appState.uiState.selectedWordIndex - 1);
            appState.uiState.setSelectedWordIndex(previousWordIndex);
            event.preventDefault();
            event.stopPropagation();
            return;
        case "ArrowRight":
            const tossup: Tossup | undefined = appState.game.getTossup(appState.uiState.cycleIndex);
            const nextWordIndex: number = Math.min(
                appState.uiState.selectedWordIndex + 1,
                tossup == undefined ? 0 : tossup.getWords(appState.game.gameFormat).length - 1
            );
            appState.uiState.setSelectedWordIndex(nextWordIndex);
            event.preventDefault();
            event.stopPropagation();
            return;
        case " ":
            if (appState.uiState.selectedWordIndex < 0) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            TossupQuestionController.selectWordFromKeyboardEvent(appState, event);
            return;
        default:
            break;
    }
}

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
