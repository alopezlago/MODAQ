import React from "react";
import { observer } from "mobx-react-lite";
import { DefaultButton, IButtonStyles, PrimaryButton } from "@fluentui/react/lib/Button";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { useId } from "@fluentui/react-hooks";

import { UIState } from "../state/UIState";
import { AppState } from "../state/AppState";
import { ILabelStyles, Label, TooltipHost } from "@fluentui/react";
import { StateContext } from "../contexts/StateContext";
import { StatusDisplayType } from "../state/StatusDisplayType";

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
const questionLableStyle: Partial<ILabelStyles> = {
    root: {
        display: "inline-flex",
    },
};
const nextButtonStyle: Partial<IButtonStyles> = {
    root: {
        marginLeft: 10,
    },
};

export const CycleChooser = observer(function CycleChooser() {
    const appState: AppState = React.useContext(StateContext);
    const onPreviousClickHandler = React.useCallback(() => onPreviousClick(appState), [appState]);
    const onNextClickHandler = React.useCallback(() => onNextClick(appState), [appState]);
    const onProposedQuestionNumberBlurHandler = React.useCallback((ev) => onProposedQuestionNumberBlur(ev, appState), [
        appState,
    ]);
    const onProposedQuestionNumberKeyDownHandler = React.useCallback(
        (ev) => onProposedQuestionNumberKeyDown(ev, appState),
        [appState]
    );
    const onQuestionLabelDoubleClickHandler = React.useCallback(() => onQuestionLabelDoubleClick(appState), [appState]);

    const uiState: UIState = appState.uiState;

    const previousButtonTooltipId: string = useId();
    const previousButton: JSX.Element = (
        <TooltipHost
            aria-describedby={previousButtonTooltipId}
            content="Previous (Shift+P)"
            id={previousButtonTooltipId}
        >
            <DefaultButton
                key="previousButton"
                onClick={onPreviousClickHandler}
                disabled={uiState.cycleIndex === 0}
                styles={previousButtonStyle}
            >
                &larr; Previous
            </DefaultButton>
        </TooltipHost>
    );

    let nextButton: JSX.Element;
    let nextButtonTooltip;
    const doesNextButtonExport: boolean = shouldNextButtonExport(appState);
    if (doesNextButtonExport) {
        nextButtonTooltip = "Export";
        nextButton = (
            <PrimaryButton
                aria-describedby={nextButtonTooltip}
                key="nextButton"
                onClick={onNextClickHandler}
                styles={nextButtonStyle}
            >
                Export...
            </PrimaryButton>
        );
    } else {
        nextButtonTooltip = "Next (Shift+N)";
        nextButton = (
            <DefaultButton
                aria-describedby={nextButtonTooltip}
                key="nextButton"
                onClick={onNextClickHandler}
                styles={nextButtonStyle}
            >
                Next →
            </DefaultButton>
        );
    }

    const nextButtonTooltipId: string = useId();
    const nextButtonWrapper: JSX.Element = (
        <TooltipHost content={nextButtonTooltip} id={nextButtonTooltipId}>
            {nextButton}
        </TooltipHost>
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
            <Label key="questionViewer" styles={questionLableStyle} onDoubleClick={onQuestionLabelDoubleClickHandler}>
                Question #{questionNumber}
            </Label>
        );
    }

    return (
        <div>
            {previousButton}
            {questionNumberViewer}
            {nextButtonWrapper}
        </div>
    );
});

function shouldNextButtonExport(appState: AppState): boolean {
    const nextCycleIndex: number = appState.uiState.cycleIndex + 1;
    return nextCycleIndex >= appState.game.playableCycles.length;
}

function onProposedQuestionNumberBlur(event: React.FocusEvent<HTMLInputElement>, appState: AppState): void {
    commitCycleIndex(appState, event.currentTarget.value);
}

function onProposedQuestionNumberKeyDown(event: React.KeyboardEvent<HTMLInputElement>, appState: AppState): void {
    if (event.which == ReturnKeyCode) {
        commitCycleIndex(appState, event.currentTarget.value);
    }
}

function onNextClick(appState: AppState): void {
    if (shouldNextButtonExport(appState)) {
        // If they use Sheets, show the Export Sheets dialog. Otherwise, show the Export JSON dialog
        if (appState.uiState.customExportOptions != undefined) {
            appState.handleCustomExport(StatusDisplayType.MessageDialog);
        } else if (appState.uiState.sheetsState.sheetId != undefined) {
            appState.uiState.createPendingSheet();
        } else {
            appState.uiState.dialogState.showExportToJsonDialog();
        }
    } else {
        appState.uiState.nextCycle();
    }
}

function onPreviousClick(appState: AppState): void {
    appState.uiState.previousCycle();
}

function onQuestionLabelDoubleClick(appState: AppState): void {
    // The question number is one higher than the cycle index
    appState.uiState.setIsEditingCycleIndex(true);
}

function commitCycleIndex(appState: AppState, value: string): void {
    if (value == undefined) {
        return;
    }

    const propsedCycleIndex: number = parseInt(value, 10);
    if (propsedCycleIndex >= 1 && propsedCycleIndex <= appState.game.packet.tossups.length) {
        appState.uiState.setCycleIndex(propsedCycleIndex - 1);
    }

    appState.uiState.setIsEditingCycleIndex(false);
}
