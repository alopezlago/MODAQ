import React from "react";
import { observer } from "mobx-react-lite";
import { DefaultButton, IButtonStyles } from "@fluentui/react/lib/Button";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";

import { UIState } from "src/state/UIState";
import { AppState } from "src/state/AppState";

const ReturnKeyCode = 13;
const questionNumberTextStyle: Partial<ITextFieldStyles> = {
    root: {
        display: "inline-flex",
        width: 40,
        margin: "0 10px",
    },
    field: {
        textAlign: "center",
    },
};
const previousButtonStyle: Partial<IButtonStyles> = {
    root: {
        marginRight: 10,
    },
};
const nextButtonStyle: Partial<IButtonStyles> = {
    root: {
        marginLeft: 10,
    },
};

export const CycleChooser = observer((props: ICycleChooserProps) => {
    const onPreviousClickHandler = React.useCallback(() => onPreviousClick(props), [props]);
    const onNextClickHandler = React.useCallback(() => onNextClick(props), [props]);
    const onProposedQuestionNumberBlurHandler = React.useCallback((ev) => onProposedQuestionNumberBlur(ev, props), [
        props,
    ]);
    const onProposedQuestionNumberKeyDownHandler = React.useCallback(
        (ev) => onProposedQuestionNumberKeyDown(ev, props),
        [props]
    );
    const onQuestionLabelDoubleClickHandler = React.useCallback(() => onQuestionLabelDoubleClick(props), [props]);

    const uiState: UIState = props.appState.uiState;

    // TODO: Move away from buttons to something like images
    const previousButton: JSX.Element = (
        <DefaultButton
            key="previousButton"
            onClick={onPreviousClickHandler}
            disabled={uiState.cycleIndex === 0}
            styles={previousButtonStyle}
        >
            &larr; Previous
        </DefaultButton>
    );
    const nextButton: JSX.Element = (
        <DefaultButton
            key="nextButton"
            onClick={onNextClickHandler}
            disabled={!nextDisabled(props)}
            styles={nextButtonStyle}
        >
            Next &rarr;
        </DefaultButton>
    );

    const questionNumber: number = uiState.cycleIndex + 1;
    let questionNumberViewer: JSX.Element | null = null;
    if (uiState.isEditingCycleIndex) {
        questionNumberViewer = (
            <TextField
                type="text"
                defaultValue={questionNumber.toString()}
                onBlur={onProposedQuestionNumberBlurHandler}
                onKeyDown={onProposedQuestionNumberKeyDownHandler}
                tabIndex={0}
                autoFocus={true}
                styles={questionNumberTextStyle}
            />
        );
    } else {
        questionNumberViewer = (
            <span
                key="questionViewer"
                className="current-question-label"
                onDoubleClick={onQuestionLabelDoubleClickHandler}
            >
                Question #{questionNumber}
            </span>
        );
    }

    return (
        <div>
            {previousButton}
            {questionNumberViewer}
            {nextButton}
        </div>
    );
});

// We may want these to be computed properties in the UIState, but that requires it having access to the packet
function nextDisabled(props: ICycleChooserProps): boolean {
    return props.appState.uiState.cycleIndex + 1 < props.appState.game.packet.tossups.length;
}

function onProposedQuestionNumberBlur(event: React.FocusEvent<HTMLInputElement>, props: ICycleChooserProps): void {
    commitCycleIndex(props, event.currentTarget.value);
}

function onProposedQuestionNumberKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    props: ICycleChooserProps
): void {
    if (event.which == ReturnKeyCode) {
        commitCycleIndex(props, event.currentTarget.value);
    }
}

function onNextClick(props: ICycleChooserProps): void {
    props.appState.uiState.nextCycle();
}

function onPreviousClick(props: ICycleChooserProps): void {
    props.appState.uiState.previousCycle();
}

function onQuestionLabelDoubleClick(props: ICycleChooserProps): void {
    // The question number is one higher than the cycle index
    props.appState.uiState.setIsEditingCycleIndex(true);
}

function commitCycleIndex(props: ICycleChooserProps, value: string): void {
    if (value == undefined) {
        return;
    }

    const propsedCycleIndex: number = parseInt(value, 10);
    if (propsedCycleIndex >= 1 && propsedCycleIndex <= props.appState.game.packet.tossups.length) {
        props.appState.uiState.setCycleIndex(propsedCycleIndex - 1);
    }

    props.appState.uiState.setIsEditingCycleIndex(false);
}

export interface ICycleChooserProps {
    appState: AppState;
}
