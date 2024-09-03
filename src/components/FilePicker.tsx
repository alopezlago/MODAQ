import React from "react";
import { observer } from "mobx-react-lite";
import { Label, DefaultButton, mergeStyleSets, Stack, StackItem, IStackStyles } from "@fluentui/react";

const fileDraggedOverStyle: IStackStyles = {
    root: {
        border: "1px dotted gray",
    },
};

export const FilePicker = observer(function FilePicker(props: React.PropsWithChildren<IFilePickerProps>): JSX.Element {
    // Not worth keeping this state in UIState, so just track it here. This should only be used for styling
    const [fileDraggedOver, setFileDraggedOver] = React.useState<boolean>(false);

    const fileInput: React.MutableRefObject<HTMLInputElement | null> = React.useRef<HTMLInputElement | null>(null);
    const changeHandler = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const files: FileList | null | undefined = fileInput.current?.files;
            if (files == undefined || files.length === 0) {
                return;
            }

            props.onChange(event, files[0]);
        },
        [props]
    );
    const dropHandler = React.useCallback(
        (event: React.DragEvent<HTMLElement>) => {
            setFileDraggedOver(false);

            if (event.dataTransfer.items.length === 0) {
                return;
            }

            const file: File | null = event.dataTransfer.items[0].getAsFile();
            if (file == undefined) {
                return;
            }

            event.preventDefault();

            props.onChange(event, file);
        },
        [props]
    );

    const classNames: IFileInputClassNames = getClassNames();
    const label: JSX.Element | false = props.label != undefined && (
        <Label required={props.required}>{props.label}</Label>
    );

    // The border can make the border a little jumpy. A low priority issue for now.
    const stackStyles: IStackStyles | undefined = fileDraggedOver ? fileDraggedOverStyle : undefined;

    return (
        <Stack
            onDrop={dropHandler}
            onDragOver={(ev) => {
                setFileDraggedOver(true);
                ev.preventDefault();
            }}
            onDragLeave={() => setFileDraggedOver(false)}
            styles={stackStyles}
        >
            <StackItem>{label}</StackItem>
            <StackItem>
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
            </StackItem>
        </Stack>
    );
});

export interface IFilePickerProps {
    accept?: string;
    buttonText: string;
    label?: string;
    required?: boolean;

    onChange(event: React.SyntheticEvent, file: File): void;
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
