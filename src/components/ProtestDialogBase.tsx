import * as React from "react";
import { Dialog, DialogFooter, IDialogContentProps, DialogType } from "office-ui-fabric-react/lib/Dialog";
import { PrimaryButton, DefaultButton } from "office-ui-fabric-react/lib/Button";

import { TextField } from "office-ui-fabric-react/lib/TextField";

export const ProtestDialogBase = (props: IProtestDialogBaseProps): JSX.Element => {
    const [reason, setReason] = React.useState("");
    const changeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => setReason(newValue ?? ""),
        [props]
    );
    const submitHandler = React.useCallback(() => onSubmit(props, reason, setReason), [props]);
    const cancelHandler = React.useCallback(() => onCancel(props, setReason), [props]);

    const content: IDialogContentProps = {
        type: DialogType.normal,
        title: "Add Protest",
        closeButtonAriaLabel: "Close",
    };

    return (
        <Dialog hidden={props.hidden} dialogContentProps={content}>
            <TextField label="Reason for the protest" value={reason} multiline={true} onChange={changeHandler} />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={submitHandler} />
                <DefaultButton text="Cancel" onClick={cancelHandler} />
            </DialogFooter>
        </Dialog>
    );
};

function onSubmit(
    props: IProtestDialogBaseProps,
    reason: string,
    setReason: React.Dispatch<React.SetStateAction<string>>
): void {
    props.onSubmit(reason);
    setReason("");
    props.hideDialog();
}

function onCancel(props: IProtestDialogBaseProps, setReason: React.Dispatch<React.SetStateAction<string>>): void {
    setReason("");
    props.hideDialog();
}

export interface IProtestDialogBaseProps {
    hidden: boolean;

    hideDialog: () => void;
    onSubmit: (reason: string) => void;
}
