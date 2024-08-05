import React from "react";
import { observer } from "mobx-react-lite";
import { Label, DefaultButton, mergeStyleSets } from "@fluentui/react";

export const FilePicker = observer(function FilePicker(props: React.PropsWithChildren<IFilePickerProps>): JSX.Element {
    const fileInput: React.MutableRefObject<HTMLInputElement | null> = React.useRef<HTMLInputElement | null>(null);
    const changeHandler = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            props.onChange(event, fileInput.current?.files);
        },
        [props]
    );

    const classNames: IFileInputClassNames = getClassNames();
    const label: JSX.Element | false = props.label != undefined && (
        <Label required={props.required}>{props.label}</Label>
    );

    return (
        <>
            {label}
            <input
                type="file"
                className={classNames.fileInput}
                accept={props.accept}
                ref={fileInput}
                onChange={changeHandler}
            />
            <DefaultButton
                text={props.buttonText}
                onClick={() => {
                    fileInput.current?.click();
                }}
            />
            {props.children}
        </>
    );
});

export interface IFilePickerProps {
    accept?: string;
    buttonText: string;
    label?: string;
    required?: boolean;

    onChange(event: React.ChangeEvent<HTMLInputElement>, fileList: FileList | null | undefined): void;
}

interface IFileInputClassNames {
    fileInput: string;
}

const getClassNames = (): IFileInputClassNames =>
    mergeStyleSets({
        fileInput: {
            display: "none",
        },
    });
