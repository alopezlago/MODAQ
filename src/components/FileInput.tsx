import React from "react";
import { observer } from "mobx-react";

export const FileInput = observer(
    (props: IFileInputProps): JSX.Element => {
        const fileInput: React.MutableRefObject<null> = React.useRef(null);
        const uploadHandler = React.useCallback(
            (event: React.ChangeEvent<HTMLInputElement>) => {
                onChange(props, fileInput, event);
            },
            [props]
        );
        const accept: string = props.accept ?? ".json";

        // TODO: Cover up the input with a button, overlaid on top
        return <input type="file" accept={accept} ref={fileInput} onChange={uploadHandler} />;
    }
);

function onChange(
    props: IFileInputProps,
    fileInput: React.RefObject<HTMLInputElement>,
    event: React.ChangeEvent<HTMLInputElement>
): void {
    event.preventDefault();
    if (fileInput.current?.files == undefined) {
        return;
    }

    const fileReader = new FileReader();
    fileReader.onload = props.onLoad;
    fileReader.readAsText(fileInput.current.files[0]);
}

export interface IFileInputProps {
    onLoad(ev: ProgressEvent<FileReader>): void;
    accept?: string;
}
