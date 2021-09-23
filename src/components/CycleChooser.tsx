import React from "react";
import { observer } from "mobx-react-lite";
import { DefaultButton, IButtonStyles } from "@fluentui/react/lib/Button";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { useId } from "@fluentui/react-hooks";

import { UIState } from "src/state/UIState";
import { AppState } from "src/state/AppState";
import { ILabelStyles, Label, TooltipHost } from "@fluentui/react";
import { StateContext } from "src/contexts/StateContext";

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

export const CycleChooser = observer(() => {
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

    const doesNextButtonExport: boolean = shouldNextButtonExport(appState);
    const nextButtonText: string = doesNextButtonExport ? "Export..." : "Next →";
    const nextButtonTooltip: string = doesNextButtonExport ? "Export" : "Next (Shift+N)";
    const nextButtonTooltipId: string = useId();
    const nextButton: JSX.Element = (
        <TooltipHost content={nextButtonTooltip} id={nextButtonTooltipId}>
            <DefaultButton
                aria-describedby={nextButtonTooltipId}
                key="nextButton"
                onClick={onNextClickHandler}
                styles={nextButtonStyle}
            >
                {nextButtonText}
            </DefaultButton>
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
            {nextButton}
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
        if (appState.uiState.customExport != undefined) {
            appState.handleCustomExport();
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
