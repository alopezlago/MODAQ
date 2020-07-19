import * as React from "react";
import { observer } from "mobx-react";
import { createUseStyles } from "react-jss";

import * as FormattedTextParser from "src/parser/FormattedTextParser";
import { UIState } from "src/state/UIState";
import { Tossup } from "src/state/PacketState";
import { QuestionWord } from "./QuestionWord";
import { Cycle } from "src/state/Cycle";
import { BuzzMenu } from "./BuzzMenu";
import { GameState } from "src/state/GameState";
import { Answer } from "./Answer";
import { IFormattedText } from "src/parser/IFormattedText";
import { TossupProtestDialog } from "./TossupProtestDialog";
import { CancelButton } from "./CancelButton";

export const TossupQuestion = observer(
    (props: IQuestionProps): JSX.Element => {
        const classes: ITossupQuestionStyle = useStyles();

        const questionWords: JSX.Element[] = generateQuestionWords(props);
        const wordClickHandler: React.MouseEventHandler = React.useCallback(
            (event: React.MouseEvent<HTMLDivElement>): void => {
                onTossupTextClicked(props, event);
            },
            [props]
        );
        const throwOutClickHandler: () => void = React.useCallback(() => {
            props.cycle.addThrownOutTossup(props.tossupNumber - 1);
            props.uiState.setSelectedWordIndex(-1);
        }, [props]);

        // Need tossuptext/answer in one container, X in the other
        return (
            <div className={classes.tossupContainer}>
                <TossupProtestDialog cycle={props.cycle} uiState={props.uiState} />
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

// TODO: Look into caching or memoizing this value, maybe with React.useMemo?
function generateQuestionWords(props: IQuestionProps): JSX.Element[] {
    const correctBuzzIndex: number = props.cycle.correctBuzz?.marker.position ?? -1;
    const wrongBuzzIndexes: number[] = props.cycle.incorrectBuzzes
        .filter((buzz) => buzz.tossupIndex === props.tossupNumber - 1)
        .map((buzz) => buzz.marker.position);

    const selectedWordRef: React.MutableRefObject<null> = React.useRef(null);

    // We need a last character that the reader can click on if the player buzzes in at the end.
    const questionWords: IFormattedText[][] = React.useMemo(
        () =>
            FormattedTextParser.splitFormattedTextIntoWords(props.tossup.question).concat([
                [{ text: "■", emphasized: false, required: false }],
            ]),
        [props]
    );

    return questionWords.map((word, index) => {
        return (
            <QuestionWordWrapper
                key={`qw_${index}`}
                correctBuzzIndex={correctBuzzIndex}
                index={index}
                selectedWordRef={selectedWordRef}
                word={word}
                wrongBuzzIndexes={wrongBuzzIndexes}
                {...props}
            />
        );
    });
}

function onTossupTextClicked(props: IQuestionProps, event: React.MouseEvent<HTMLDivElement>): void {
    const target = event.target as HTMLDivElement;

    // I'd like to avoid looking for a specific HTML element instead of a class. This would mean giving QuestionWord a
    // fixed class.
    const questionWord: HTMLSpanElement | null = target.closest("span");
    if (questionWord == undefined || questionWord.getAttribute == undefined) {
        return;
    }

    const index = parseInt(questionWord.getAttribute("data-value") ?? "", 10);
    if (index < 0) {
        return;
    }

    const selectedIndex = props.uiState.selectedWordIndex === index ? -1 : index;
    props.uiState.setSelectedWordIndex(selectedIndex);
    props.uiState.showBuzzMenu();

    event.preventDefault();
    event.stopPropagation();
}

// We need to use a wrapper component so we can give it a key. Otherwise, React will complain
const QuestionWordWrapper = observer((props: IQuestionWordWrapperProps) => {
    const selected: boolean = props.index === props.uiState.selectedWordIndex;

    const buzzMenu: JSX.Element | undefined =
        selected && props.uiState.buzzMenuVisible ? (
            <BuzzMenu
                bonusIndex={props.bonusIndex}
                cycle={props.cycle}
                game={props.game}
                position={props.index}
                target={props.selectedWordRef}
                tossup={props.tossup}
                tossupNumber={props.tossupNumber}
                uiState={props.uiState}
            />
        ) : undefined;

    return (
        <>
            <QuestionWord
                index={props.index}
                word={props.word}
                selected={props.index === props.uiState.selectedWordIndex}
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
    bonusIndex: number;
    cycle: Cycle;
    game: GameState;
    tossup: Tossup;
    tossupNumber: number;
    uiState: UIState;
}

interface IQuestionWordWrapperProps {
    bonusIndex: number;
    correctBuzzIndex: number;
    cycle: Cycle;
    game: GameState;
    index: number;
    selectedWordRef: React.MutableRefObject<null>;
    tossup: Tossup;
    tossupNumber: number;
    uiState: UIState;
    word: IFormattedText[];
    wrongBuzzIndexes: number[];
}

interface ITossupQuestionStyle {
    tossupContainer: string;
    tossupQuestionText: string;
    tossupText: string;
}

const useStyles: () => ITossupQuestionStyle = createUseStyles({
    tossupContainer: {
        paddingLeft: "24px",
        display: "flex",
        justifyContent: "space-between",
    },
    tossupQuestionText: {
        display: "inline",
    },
    tossupText: {
        maxHeight: "37.5vh",
        overflowY: "auto",
    },
});
