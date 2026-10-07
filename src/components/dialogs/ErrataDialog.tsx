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
import { ErrataDialogState } from "../../state/ErrataDialogState";
import { IErratum, QuestionType } from "../../state/IErratum";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

export const ErrataDialog = observer(function ErrataDialog(): JSX.Element {
    const appState: AppState = useAppState();
    const errataDialog: ErrataDialogState | undefined = appState.uiState.dialogState.errataDialog;

    const hideHandler = React.useCallback(() => ErrataDialogController.hideDialog(appState), [appState]);

    return (
        <ModalDialog
            title={errataDialog == undefined ? "Errata" : `Errata for ${getQuestionName(errataDialog)}`}
            visibilityStatus={ModalVisibilityStatus.Errata}
            onDismiss={hideHandler}
            minWidth="30vw"
        >
            <ErrataDialogBody appState={appState} />
            <DialogFooter>
                <PrimaryButton text="Save" onClick={() => ErrataDialogController.submit(appState)} />
                {errataDialog?.existed && (
                    <DefaultButton text="Remove" onClick={() => ErrataDialogController.removeErratum(appState)} />
                )}
                <DefaultButton text="Cancel" onClick={hideHandler} />
            </DialogFooter>
        </ModalDialog>
    );
});

const ErrataDialogBody = observer(function ErrataDialogBody(props: { appState: AppState }): JSX.Element {
    const appState: AppState = props.appState;
    const errataDialog: ErrataDialogState | undefined = appState.uiState.dialogState.errataDialog;
    if (errataDialog == undefined) {
        return <></>;
    }

    const classes: IErrataDialogClassNames = getClassNames();
    const answers: string[] = getAnswers(appState, errataDialog.questionNumber, errataDialog.questionType);

    // Errata on other questions, so the moderator can review everything they've flagged before exporting
    const otherErrata: IErratum[] = appState.errata
        .getSortedErrata()
        .filter(
            (erratum) =>
                !(
                    erratum.questionNumber === errataDialog.questionNumber &&
                    erratum.questionType === errataDialog.questionType
                )
        );

    return (
        <Stack tokens={{ childrenGap: 10 }}>
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
                    autoFocus={true}
                    label="What was wrong with this question?"
                    multiline
                    rows={4}
                    value={errataDialog.text}
                    placeholder="e.g. The answer line should also accept &quot;hertz&quot;."
                    onChange={(ev, newValue) => ErrataDialogController.changeText(appState, newValue ?? "")}
                />
            </StackItem>
            <StackItem>
                <span>
                    Errata come down in their own file when you export the game, so they stay out of the QBJ that
                    stats programs import.
                </span>
            </StackItem>
            {otherErrata.length > 0 && (
                <StackItem>
                    <Stack tokens={{ childrenGap: 4 }}>
                        <StackItem>
                            <strong>Other errata in this packet</strong>
                        </StackItem>
                        {otherErrata.map((erratum) => (
                            <Stack
                                key={`${erratum.questionType}-${erratum.questionNumber}`}
                                horizontal
                                verticalAlign="center"
                                tokens={{ childrenGap: 8 }}
                            >
                                <StackItem grow>
                                    <strong>{getQuestionName(erratum)}</strong>
                                    {erratum.text ? `: ${erratum.text}` : ""}
                                </StackItem>
                                <StackItem>
                                    <IconButton
                                        ariaLabel={`Remove the erratum for ${getQuestionName(erratum)}`}
                                        title={`Remove the erratum for ${getQuestionName(erratum)}`}
                                        iconProps={{ iconName: "Delete" }}
                                        onClick={() =>
                                            appState.errata.removeErratum(
                                                erratum.questionNumber,
                                                erratum.questionType
                                            )
                                        }
                                    />
                                </StackItem>
                            </Stack>
                        ))}
                    </Stack>
                </StackItem>
            )}
        </Stack>
    );
});

function getQuestionName(question: { questionNumber: number; questionType: QuestionType }): string {
    return `${question.questionType === "bonus" ? "Bonus" : "Tossup"} ${question.questionNumber}`;
}

// The answer line is the quickest way for the moderator to confirm they're flagging the question they mean. A
// bonus has one per part; a question that isn't in the packet has none.
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
                maxHeight: "25vh",
                overflowY: "auto",
            },
        })
);
