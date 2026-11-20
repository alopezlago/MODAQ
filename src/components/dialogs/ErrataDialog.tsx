import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    DefaultButton,
    DialogFooter,
    IconButton,
    memoizeFunction,
    mergeStyleSets,
    PrimaryButton,
    Stack,
    StackItem,
    TextField,
} from "@fluentui/react";

import * as ErrataDialogController from "./ErrataDialogController";
import { Answer } from "../Answer";
import { AppState } from "../../state/AppState";
import { useAppState } from "../../contexts/StateContext";
import { IErratum, QuestionType } from "../../state/IErratum";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

// The end-of-round review. During the round moderators only mark questions (R, or the question's flag); this is where
// they say what was wrong with each one before the game is exported.
export const ErrataDialog = observer(function ErrataDialog(): JSX.Element {
    const appState: AppState = useAppState();

    const hideHandler = React.useCallback(() => ErrataDialogController.hideDialog(appState), [appState]);
    const continueHandler = React.useCallback(() => ErrataDialogController.continueToExport(appState), [appState]);

    return (
        <ModalDialog
            title="Review errata"
            visibilityStatus={ModalVisibilityStatus.Errata}
            onDismiss={hideHandler}
            minWidth="40vw"
        >
            <ErrataDialogBody appState={appState} />
            <DialogFooter>
                <PrimaryButton text="Continue to export" onClick={continueHandler} />
                <DefaultButton text="Back to game" onClick={hideHandler} />
            </DialogFooter>
        </ModalDialog>
    );
});

const ErrataDialogBody = observer(function ErrataDialogBody(props: { appState: AppState }): JSX.Element {
    const appState: AppState = props.appState;
    const errata: IErratum[] = appState.errata.getSortedErrata();

    if (errata.length === 0) {
        return <span>No questions are marked as having errata.</span>;
    }

    return (
        <Stack tokens={{ childrenGap: 16 }}>
            <StackItem>
                <span>
                    Describe what was wrong with each question you marked, or remove any you marked by mistake. Errata
                    come down in their own file when you export the game, so they stay out of the QBJ that stats
                    programs import.
                </span>
            </StackItem>
            {errata.map((erratum, index) => (
                <ErratumEditor
                    key={`${erratum.questionType}-${erratum.questionNumber}`}
                    appState={appState}
                    autoFocus={index === 0}
                    erratum={erratum}
                />
            ))}
        </Stack>
    );
});

const ErratumEditor = observer(function ErratumEditor(props: IErratumEditorProps): JSX.Element {
    const { appState, erratum } = props;
    const classes: IErrataDialogClassNames = getClassNames();
    const questionName: string = getQuestionName(erratum);
    const answers: string[] = getAnswers(appState, erratum.questionNumber, erratum.questionType);

    return (
        <Stack tokens={{ childrenGap: 4 }}>
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                <StackItem grow>
                    <strong>{questionName}</strong>
                </StackItem>
                <StackItem>
                    <IconButton
                        ariaLabel={`Remove the erratum for ${questionName}`}
                        title={`Remove the erratum for ${questionName}`}
                        iconProps={{ iconName: "Delete" }}
                        onClick={() =>
                            ErrataDialogController.removeErratum(appState, erratum.questionNumber, erratum.questionType)
                        }
                    />
                </StackItem>
            </Stack>
            {answers.length > 0 && (
                <StackItem className={classes.answers}>
                    {/* Rendered the way the reader sees it, rather than as the packet's raw <b>/<u> markup. A
                        bonus gets one line per part, so it's clear which part an erratum is about. */}
                    {answers.map((answer, index) => (
                        <Answer key={index} text={answer} />
                    ))}
                </StackItem>
            )}
            <StackItem>
                <TextField
                    ariaLabel={`What was wrong with ${questionName}?`}
                    autoFocus={props.autoFocus}
                    multiline
                    rows={2}
                    value={erratum.text}
                    placeholder="e.g. The answer line should also accept &quot;hertz&quot;."
                    onChange={(ev, newValue) =>
                        ErrataDialogController.changeText(
                            appState,
                            erratum.questionNumber,
                            erratum.questionType,
                            newValue ?? ""
                        )
                    }
                />
            </StackItem>
        </Stack>
    );
});

interface IErratumEditorProps {
    appState: AppState;
    autoFocus: boolean;
    erratum: IErratum;
}

function getQuestionName(question: { questionNumber: number; questionType: QuestionType }): string {
    return `${question.questionType === "bonus" ? "Bonus" : "Tossup"} ${question.questionNumber}`;
}

// The answer line is the quickest way for the moderator to recall which question they marked. A bonus has one per
// part; a question that isn't in the packet has none.
function getAnswers(appState: AppState, questionNumber: number, questionType: QuestionType): string[] {
    const index: number = questionNumber - 1;
    if (questionType === "tossup") {
        const answer: string | undefined = appState.game.packet.tossups[index]?.answer;
        return answer == undefined ? [] : [answer];
    }

    return appState.game.packet.bonuses[index]?.parts.map((part) => part.answer) ?? [];
}

interface IErrataDialogClassNames {
    answers: string;
}

const getClassNames = memoizeFunction(
    (): IErrataDialogClassNames =>
        mergeStyleSets({
            // The answer line is context, not the thing being edited, so keep it quieter than the text field. Long
            // answer lines scroll rather than pushing the text field out of a small window.
            answers: {
                color: "inherit",
                opacity: 0.8,
                maxHeight: "15vh",
                overflowY: "auto",
            },
        })
);
