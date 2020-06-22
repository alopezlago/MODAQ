import React from "react";

// TODO: Convert this into a functional component so it can be styled
export class FileInput extends React.Component<IFileInputProps> {
    private readonly fileInput: React.RefObject<HTMLInputElement>;

    constructor(props: IFileInputProps) {
        super(props);

        this.fileInput = React.createRef();
    }

    private onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        event.preventDefault();
        if (this.fileInput.current?.files == undefined) {
            return;
        }

        const fileReader = new FileReader();
        fileReader.onload = this.props.onLoad;
        fileReader.readAsText(this.fileInput.current.files[0]);
    };

    public render(): JSX.Element {
        const accept: string = this.props.accept ?? ".json";

        return (
            <div>
                <label>
                    Upload file:
                    <input type="file" accept={accept} ref={this.fileInput} onChange={this.onChange} />
                </label>
            </div>
        );
    }
}

export interface IFileInputProps {
    onLoad(ev: ProgressEvent<FileReader>): void;
    accept?: string;
}
