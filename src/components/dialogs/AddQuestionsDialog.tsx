import * as React from "react";
import { observer } from "mobx-react-lite";
import { DialogFooter, PrimaryButton, DefaultButton, Stack, StackItem, Label } from "@fluentui/react";

import * as AddQuestionsDialogController from "./AddQuestionsDialogController";
import { AppState } from "../../state/AppState";
import { PacketLoader } from "../PacketLoader";
import { useAppState } from "../../contexts/StateContext";
import { useTiebreakers } from "../../contexts/TiebreakerContext";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

// Plain-text preview of a packet question (strip HTML + power marker).
function preview(text: string, max = 90): string {
    const plain = text.replace(/<[^>]+>/g, "").replace(/\(\*\)/g, "").replace(/\s+/g, " ").trim();
    return plain.length > max ? plain.slice(0, max) + "…" : plain;
}

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const AddQuestionsDialog = observer(function AddQuestionsDialog(): JSX.Element {
    const appState: AppState = useAppState();

    return (
        <ModalDialog
            title="Add Questions"
            visibilityStatus={ModalVisibilityStatus.AddQuestions}
            onDismiss={() => AddQuestionsDialogController.cancel(appState)}
        >
            <AddQuestionsDialogBody appState={appState} />
            <DialogFooter>
                <PrimaryButton text="Load" onClick={() => AddQuestionsDialogController.commit(appState)} />
                <DefaultButton text="Cancel" onClick={() => AddQuestionsDialogController.cancel(appState)} />
            </DialogFooter>
        </ModalDialog>
    );
});

const AddQuestionsDialogBody = observer(function AddQuestionsDialogBody(
    props: IAddQuestionsDialogBodyProps
): JSX.Element {
    const appState: AppState = props.appState;
    const tiebreakers = useTiebreakers();

    return (
        <Stack tokens={{ childrenGap: 12 }}>
            {tiebreakers && tiebreakers.tiebreakers.length > 0 && (
                <StackItem>
                    <Label>Tiebreaker questions — click to add the next tossup</Label>
                    <Stack tokens={{ childrenGap: 6 }} styles={{ root: { maxHeight: 260, overflowY: "auto" } }}>
                        {tiebreakers.tiebreakers.map((tb, i) => (
                            <Stack
                                key={`${tb.round}-${tb.questionNumber}`}
                                horizontal
                                horizontalAlign="space-between"
                                verticalAlign="center"
                                tokens={{ childrenGap: 8 }}
                            >
                                <span>
                                    <strong>
                                        {tb.round} #{tb.questionNumber}
                                    </strong>
                                    : {preview(tb.question)} <em>({preview(tb.answer, 40)})</em>
                                </span>
                                <DefaultButton
                                    text="Add"
                                    onClick={() => {
                                        tiebreakers.addTiebreaker(i);
                                        AddQuestionsDialogController.cancel(appState);
                                    }}
                                />
                            </Stack>
                        ))}
                    </Stack>
                </StackItem>
            )}
            <StackItem>
                <PacketLoader
                    appState={appState}
                    onLoad={(packet) => AddQuestionsDialogController.loadPacket(appState, packet)}
                />
            </StackItem>
        </Stack>
    );
});

interface IAddQuestionsDialogBodyProps {
    appState: AppState;
}
