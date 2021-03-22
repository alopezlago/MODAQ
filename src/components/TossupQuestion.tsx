import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets } from "@fluentui/react";

import { UIState } from "src/state/UIState";
import { Tossup } from "src/state/PacketState";
import { QuestionWord } from "./QuestionWord";
import { Cycle } from "src/state/Cycle";
import { BuzzMenu } from "./BuzzMenu";
import { Answer } from "./Answer";
import { IFormattedText } from "src/parser/IFormattedText";
import { TossupProtestDialog } from "./dialogs/TossupProtestDialog";
import { CancelButton } from "./CancelButton";
import { AppState } from "src/state/AppState";

export const TossupQuestion = observer(
    (props: IQuestionProps): JSX.Element => {
        const classes: ITossupQuestionClassNames = getClassNames();

        const selectedWordRef: React.MutableRefObject<null> = React.useRef(null);

        const correctBuzzIndex: number = props.cycle.correctBuzz?.marker.position ?? -1;
        const wrongBuzzIndexes: number[] = props.cycle.incorrectBuzzes
            .filter((buzz) => buzz.tossupIndex === props.tossupNumber - 1)
            .map((buzz) => buzz.marker.position);

        const questionFormattedTexts: IFormattedText[][] = props.tossup.formattedQuestionText;

        const questionWords: JSX.Element[] = [];
        let wordIndex = 0;
        let nonwordIndex = 0;
        for (const word of questionFormattedTexts) {
            const fullText = word.reduce((result, text) => result + text.text, "");

            // We need to skip over power markers and not count them when we calculate buzz points
            let index: number | undefined = wordIndex;
            const trimmedText: string = fullText.trim();
            const powerMarkerIndex: number = props.appState.game.gameFormat.powerMarkers.indexOf(trimmedText);
            if (powerMarkerIndex >= 0) {
                index = undefined;
                nonwordIndex++;
            } else {
                wordIndex++;
            }

            questionWords.push(
                <QuestionWordWrapper
                    key={index == undefined ? `qnw_${nonwordIndex}` : `qw_${index}`}
                    correctBuzzIndex={correctBuzzIndex}
                    index={index}
                    selectedWordRef={selectedWordRef}
                    word={word}
                    wrongBuzzIndexes={wrongBuzzIndexes}
                    {...props}
                />
            );
        }

        const wordClickHandler: React.MouseEventHandler = React.useCallback(
            (event: React.MouseEvent<HTMLDivElement>): void => {
                onTossupTextClicked(props, event);
            },
            [props]
        );
        const throwOutClickHandler: () => void = React.useCallback(() => {
            props.cycle.addThrownOutTossup(props.tossupNumber - 1);
            props.appState.uiState.setSelectedWordIndex(-1);
        }, [props]);

        // Need tossuptext/answer in one container, X in the other
        return (
            <div className={classes.tossupContainer}>
                <TossupProtestDialog appState={props.appState} cycle={props.cycle} />
                <div className={classes.tossupText}>
                    <div
                        className={classes.tossupQuestionText}
                        onClick={wordClickHandler}
                        onDoubleClick={wordClickHandler}
                    >
                        {questionWords}
                    </div>
                    <Answer text={props.tossup.answer} />
                </div>
                <div>
                    <CancelButton title="Throw out tossup" onClick={throwOutClickHandler} />
                </div>
            </div>
        );
    }
);

function onTossupTextClicked(props: IQuestionProps, event: React.MouseEvent<HTMLDivElement>): void {
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

    const uiState: UIState = props.appState.uiState;
    const selectedIndex = uiState.selectedWordIndex === index ? -1 : index;
    uiState.setSelectedWordIndex(selectedIndex);
    uiState.showBuzzMenu();

    event.preventDefault();
    event.stopPropagation();
}

// We need to use a wrapper component so we can give it a key. Otherwise, React will complain
const QuestionWordWrapper = observer((props: IQuestionWordWrapperProps) => {
    const uiState: UIState = props.appState.uiState;
    const selected: boolean = props.index === uiState.selectedWordIndex;

    const buzzMenu: JSX.Element | undefined =
        selected && props.index != undefined && uiState.buzzMenuVisible ? (
            <BuzzMenu
                appState={props.appState}
                bonusIndex={props.bonusIndex}
                cycle={props.cycle}
                position={props.index}
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
        },
        tossupText: {
            maxHeight: "37.5vh",
            overflowY: "auto",
        },
    });
