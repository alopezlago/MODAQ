import React from "react";
import { observer } from "mobx-react-lite";
import {
    Label,
    PrimaryButton,
    DefaultButton,
    SpinButton,
    Separator,
    ActionButton,
    mergeStyleSets,
} from "@fluentui/react";

import { AppState } from "../../state/AppState";
import { useAppState } from "../../contexts/StateContext";
import { IThrowOutQuestionDialogState } from "../../state/DialogState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

export const ThrowOutQuestionDialog = observer(function ThrowOutQuestionDialog(): JSX.Element {
    const appState: AppState = useAppState();
    const dialogState: IThrowOutQuestionDialogState | undefined =
        appState.uiState.dialogState.throwOutQuestionDialog;

    const [replacementNumber, setReplacementNumber] = React.useState<number | undefined>(
        dialogState?.defaultReplacementNumber
    );
    const [showCustomInput, setShowCustomInput] = React.useState(false);

    // Sync local state when dialog opens with a new default
    const prevDefault = React.useRef(dialogState?.defaultReplacementNumber);
    if (prevDefault.current !== dialogState?.defaultReplacementNumber) {
        prevDefault.current = dialogState?.defaultReplacementNumber;
        setReplacementNumber(dialogState?.defaultReplacementNumber);
        setShowCustomInput(false);
    }

    if (dialogState == undefined) {
        return <></>;
    }

    const classes = getClassNames();
    const closeHandler = (): void => hideDialog(appState);

    const confirmHandler = (): void => {
        // Convert 1-based display number to 0-based packet index
        dialogState.onConfirm(replacementNumber != undefined ? replacementNumber - 1 : undefined);
        hideDialog(appState);
    };

    const customInputSection: JSX.Element = dialogState.defaultReplacementNumber != undefined ? (
        <SpinButton
            label="Replacement question number"
            min={1}
            max={dialogState.maxQuestionNumber}
            value={replacementNumber?.toString() ?? ""}
            onValidate={(value) => {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= dialogState.maxQuestionNumber) {
                    setReplacementNumber(parsed);
                    return parsed.toString();
                }
                return (replacementNumber ?? dialogState.defaultReplacementNumber)?.toString() ?? "";
            }}
            onIncrement={(value) => {
                const parsed = parseInt(value, 10);
                const next = Math.min((isNaN(parsed) ? 1 : parsed) + 1, dialogState.maxQuestionNumber);
                setReplacementNumber(next);
                return next.toString();
            }}
            onDecrement={(value) => {
                const parsed = parseInt(value, 10);
                const prev = Math.max((isNaN(parsed) ? 1 : parsed) - 1, 1);
                setReplacementNumber(prev);
                return prev.toString();
            }}
            styles={{ root: { marginTop: 8 } }}
        />
    ) : (
        <Label styles={{ root: { marginTop: 8, fontStyle: "italic" } }}>
            No replacement available — upload additional questions before confirming.
        </Label>
    );

    return (
        <ModalDialog
            title={dialogState.title}
            visibilityStatus={ModalVisibilityStatus.ThrowOutQuestion}
            maxWidth="30vw"
            onDismiss={closeHandler}
        >
            <Label>{dialogState.message}</Label>
            <div className={classes.buttonRow}>
                <PrimaryButton text="Confirm" onClick={confirmHandler} />
                <DefaultButton text="Cancel" onClick={closeHandler} />
            </div>
            <Separator />
            <ActionButton
                iconProps={{ iconName: showCustomInput ? "ChevronDown" : "ChevronRight" }}
                onClick={() => setShowCustomInput(!showCustomInput)}
                className={classes.toggleButton}
            >
                Use a different replacement question
            </ActionButton>
            {showCustomInput && customInputSection}
        </ModalDialog>
    );
});

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideThrowOutQuestionDialog();
}

interface IThrowOutQuestionDialogClassNames {
    buttonRow: string;
    toggleButton: string;
}

const getClassNames = (): IThrowOutQuestionDialogClassNames =>
    mergeStyleSets({
        buttonRow: {
            display: "flex",
            gap: 8,
            marginTop: 16,
            marginBottom: 8,
        },
        toggleButton: {
            display: "block",
            height: 24,
            padding: 0,
            textAlign: "left",
        },
    });
