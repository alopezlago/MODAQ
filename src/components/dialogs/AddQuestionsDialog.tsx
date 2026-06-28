import * as React from "react";
import { observer } from "mobx-react-lite";
import { DialogFooter, PrimaryButton, DefaultButton, TextField, Stack, StackItem, Text } from "@fluentui/react";

import * as AddQuestionsDialogController from "./AddQuestionsDialogController";
import { AppState } from "../../state/AppState";
import { PacketLoader } from "../PacketLoader";
import { useAppState } from "../../contexts/StateContext";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const AddQuestionsDialog = observer(function AddQuestionsDialog(): JSX.Element {
    const appState: AppState = useAppState();
    const tmsActive: boolean = appState.uiState.tmsActive;

    return (
        <ModalDialog
            title="Add Questions"
            visibilityStatus={ModalVisibilityStatus.AddQuestions}
            onDismiss={() => AddQuestionsDialogController.cancel(appState)}
        >
            <AddQuestionsDialogBody appState={appState} />
            {!tmsActive && (
                <DialogFooter>
                    <PrimaryButton text="Load" onClick={() => AddQuestionsDialogController.commit(appState)} />
                    <DefaultButton text="Cancel" onClick={() => AddQuestionsDialogController.cancel(appState)} />
                </DialogFooter>
            )}
        </ModalDialog>
    );
});

const AddQuestionsDialogBody = observer(function AddQuestionsDialogBody(
    props: IAddQuestionsDialogBodyProps
): JSX.Element {
    const appState: AppState = props.appState;
    const [questionId, setQuestionId] = React.useState("");

    if (appState.uiState.tmsActive) {
        return (
            <Stack tokens={{ childrenGap: 10 }}>
                <StackItem>
                    <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                        To add a replacement question, request a secret code from the tournament director and enter
                        it below.
                    </Text>
                </StackItem>
                <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="end">
                    <StackItem grow={1}>
                        <TextField
                            placeholder="secret code"
                            value={questionId}
                            onChange={(ev, newValue) => setQuestionId(newValue ?? "")}
                        />
                    </StackItem>
                    <StackItem>
                        <PrimaryButton
                            text="Load"
                            disabled={questionId.trim().length === 0}
                            onClick={() => AddQuestionsDialogController.loadById(appState, questionId.trim())}
                        />
                    </StackItem>
                </Stack>
                {appState.uiState.packetParseStatus?.status && (
                    <StackItem>
                        <Text
                            variant="small"
                            styles={{
                                root: {
                                    color: appState.uiState.packetParseStatus.status.isError
                                        ? "#a4262c"
                                        : "#605e5c",
                                },
                            }}
                        >
                            {appState.uiState.packetParseStatus.status.status}
                        </Text>
                    </StackItem>
                )}
            </Stack>
        );
    }

    return (
        <PacketLoader
            appState={appState}
            onLoad={(packet) => AddQuestionsDialogController.loadPacket(appState, packet)}
        />
    );
});

interface IAddQuestionsDialogBodyProps {
    appState: AppState;
}
