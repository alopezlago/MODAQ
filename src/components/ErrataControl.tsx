import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    DefaultButton,
    Dialog,
    DialogFooter,
    DialogType,
    Dropdown,
    IDialogContentProps,
    IDropdownOption,
    PrimaryButton,
    Stack,
    StackItem,
    TextField,
} from "@fluentui/react";

import { AppState } from "../state/AppState";
import { useAppState } from "../contexts/StateContext";
import { useErrata } from "../contexts/ErrataContext";
import { IErratum } from "../state/IErratum";
import { ModalVisibilityStatus } from "../state/ModalVisibilityStatus";

const dialogContent: IDialogContentProps = {
    type: DialogType.normal,
    title: "Question errata",
    closeButtonAriaLabel: "Close",
    subText:
        "Flag a packet question that had an error. Errata are saved with the tournament so other moderators and the director see them.",
};

const typeOptions: IDropdownOption[] = [
    { key: "tossup", text: "Tossup" },
    { key: "bonus", text: "Bonus" },
];

// A moderator affordance to record errata for packet questions. Errata live in
// the host-provided ErrataContext (not the game state), so they persist to the
// tournament independently of scoring.
export const ErrataControl = observer(function ErrataControl(): JSX.Element | null {
    const appState: AppState = useAppState();
    const errataContext = useErrata();

    const isOpen: boolean = appState.uiState.dialogState.visibleDialog === ModalVisibilityStatus.Errata;

    // Current question number for the open cycle, used as the form default.
    const cycleIndex: number = appState.uiState.cycleIndex;
    const currentTossupNumber: number = appState.game.isLoaded ? appState.game.getTossupIndex(cycleIndex) + 1 : 1;

    const [questionType, setQuestionType] = React.useState<"tossup" | "bonus">("tossup");
    const [questionNumber, setQuestionNumber] = React.useState<number>(currentTossupNumber);
    const [text, setText] = React.useState<string>("");

    // Seed the form from the current question each time the dialog opens.
    React.useEffect(() => {
        if (isOpen) {
            setQuestionType("tossup");
            setQuestionNumber(currentTossupNumber);
            setText("");
        }
        // Only re-seed on open, not on every cycle change while open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const close = React.useCallback(() => appState.uiState.dialogState.hideModalDialog(), [appState]);

    if (errataContext == undefined || !appState.game.isLoaded) {
        // Host didn't enable errata, or no packet is loaded yet.
        return null;
    }

    const { errata, setErratum, removeErratum } = errataContext;

    const onSave = (): void => {
        const trimmed = text.trim();
        if (trimmed.length === 0) {
            // Nothing to record.
            return;
        }
        const erratum: IErratum = {
            questionNumber: Math.max(1, Math.floor(questionNumber) || 1),
            questionType,
            thrownOut: false,
            text: trimmed,
        };
        setErratum(erratum);
        close();
    };

    const sorted: IErratum[] = [...errata].sort(
        (a, b) => a.questionNumber - b.questionNumber || a.questionType.localeCompare(b.questionType)
    );

    return (
        <>
            <DefaultButton
                text={errata.length > 0 ? `Errata (${errata.length})` : "Errata"}
                iconProps={{ iconName: "Flag" }}
                title="Report an error in a packet question"
                onClick={() => appState.uiState.dialogState.showErrataDialog()}
            />
            <Dialog hidden={!isOpen} onDismiss={close} dialogContentProps={dialogContent} minWidth={480}>
                <Stack tokens={{ childrenGap: 8 }}>
                    <StackItem>
                        <Stack horizontal tokens={{ childrenGap: 12 }}>
                            <StackItem>
                                <Dropdown
                                    label="Question"
                                    selectedKey={questionType}
                                    options={typeOptions}
                                    styles={{ root: { minWidth: 120 } }}
                                    onChange={(_e, option) =>
                                        option && setQuestionType(option.key as "tossup" | "bonus")
                                    }
                                />
                            </StackItem>
                            <StackItem>
                                <TextField
                                    label="Number"
                                    type="number"
                                    min={1}
                                    value={String(questionNumber)}
                                    styles={{ root: { width: 90 } }}
                                    onChange={(_e, v) => setQuestionNumber(Number(v) || 1)}
                                />
                            </StackItem>
                        </Stack>
                    </StackItem>
                    <StackItem>
                        <TextField
                            label="Description / correction"
                            multiline
                            rows={3}
                            value={text}
                            onChange={(_e, v) => setText(v ?? "")}
                            placeholder="e.g. Answer line should also accept 'Hertz (unit)'."
                        />
                    </StackItem>
                    {sorted.length > 0 && (
                        <StackItem>
                            <Stack tokens={{ childrenGap: 6 }}>
                                {sorted.map((e) => (
                                    <Stack
                                        key={`${e.questionType}-${e.questionNumber}`}
                                        horizontal
                                        horizontalAlign="space-between"
                                        verticalAlign="center"
                                        tokens={{ childrenGap: 8 }}
                                    >
                                        <span>
                                            <strong>
                                                {e.questionType === "bonus" ? "Bonus" : "Tossup"} {e.questionNumber}
                                            </strong>
                                            {e.text ? `: ${e.text}` : ""}
                                        </span>
                                        <DefaultButton
                                            text="Remove"
                                            onClick={() => removeErratum(e.questionNumber, e.questionType)}
                                        />
                                    </Stack>
                                ))}
                            </Stack>
                        </StackItem>
                    )}
                </Stack>
                <DialogFooter>
                    <PrimaryButton text="Save erratum" onClick={onSave} />
                    <DefaultButton text="Close" onClick={close} />
                </DialogFooter>
            </Dialog>
        </>
    );
});
