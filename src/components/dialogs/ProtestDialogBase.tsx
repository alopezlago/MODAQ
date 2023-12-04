import * as React from "react";
import { DialogFooter } from "@fluentui/react/lib/Dialog";
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button";
import { observer } from "mobx-react-lite";

import { TextField } from "@fluentui/react/lib/TextField";
import { AppState } from "../../state/AppState";
import { ModalDialog } from "./ModalDialog";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";

export const ProtestDialogBase = observer(function ProtestDialogBase(
    props: React.PropsWithChildren<IProtestDialogBaseProps>
): JSX.Element {
    const givenAnswerChangeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            props.appState.uiState.updatePendingProtestGivenAnswer(newValue ?? ""),
        [props]
    );
    const reasonChangeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            props.appState.uiState.updatePendingProtestReason(newValue ?? ""),
        [props]
    );
    const submitHandler = React.useCallback(() => onSubmit(props), [props]);
    const cancelHandler = React.useCallback(() => onCancel(props), [props]);

    return (
        <ModalDialog title="Add Protest" visibilityStatus={props.visibilityStatus} onDismiss={cancelHandler}>
            {props.children}
            <TextField
                label="Given answer"
                value={props.givenAnswer}
                multiline={true}
                onChange={givenAnswerChangeHandler}
                autoFocus={props.autoFocusOnGivenAnswer}
            />
            <TextField
                label="Reason for the protest"
                value={props.reason}
                multiline={true}
                onChange={reasonChangeHandler}
            />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={submitHandler} />
                <DefaultButton text="Cancel" onClick={cancelHandler} />
            </DialogFooter>
        </ModalDialog>
    );
});

function onSubmit(props: IProtestDialogBaseProps): void {
    props.onSubmit();
    props.hideDialog();
}

function onCancel(props: IProtestDialogBaseProps): void {
    props.hideDialog();
}

export interface IProtestDialogBaseProps {
    appState: AppState;
    autoFocusOnGivenAnswer?: boolean;
    givenAnswer: string | undefined;
    visibilityStatus: ModalVisibilityStatus;
    reason: string;

    hideDialog: () => void;
    onSubmit: () => void;
}
