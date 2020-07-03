import * as React from "react";
import { Dialog, DialogFooter, IDialogContentProps, DialogType } from "office-ui-fabric-react/lib/Dialog";
import { PrimaryButton, DefaultButton } from "office-ui-fabric-react/lib/Button";

import { TextField } from "office-ui-fabric-react/lib/TextField";
import { UIState } from "src/state/UIState";

export const ProtestDialogBase = (props: React.PropsWithChildren<IProtestDialogBaseProps>): JSX.Element => {
    const changeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            props.uiState.updatePendingProtestReason(newValue ?? ""),
        [props]
    );
    const submitHandler = React.useCallback(() => onSubmit(props), [props]);
    const cancelHandler = React.useCallback(() => onCancel(props), [props]);

    const content: IDialogContentProps = {
        type: DialogType.normal,
        title: "Add Protest",
        closeButtonAriaLabel: "Close",
    };

    return (
        <Dialog hidden={props.hidden} dialogContentProps={content}>
            {props.children}
            <TextField label="Reason for the protest" value={props.reason} multiline={true} onChange={changeHandler} />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={submitHandler} />
                <DefaultButton text="Cancel" onClick={cancelHandler} />
            </DialogFooter>
        </Dialog>
    );
};

function onSubmit(props: IProtestDialogBaseProps): void {
    props.onSubmit();
    props.hideDialog();
}

function onCancel(props: IProtestDialogBaseProps): void {
    props.hideDialog();
}

export interface IProtestDialogBaseProps {
    hidden: boolean;
    reason: string;
    uiState: UIState;

    hideDialog: () => void;
    onSubmit: () => void;
}
