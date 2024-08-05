// FilePicker with status passed in as child wrapper?
// But we'd only have one status, and maybe optional fields?
// PacketLoader can xtend this further

import React from "react";
import { observer } from "mobx-react-lite";
import { Label, ThemeContext, ILabelStyles } from "@fluentui/react";
import { FilePicker, IFilePickerProps } from "./FilePicker";
import { IStatus } from "../IStatus";

export const FilePickerWithStatus = observer(function FilePickerWithStatus(
    props: React.PropsWithChildren<IFilePickerWithStatusProps>
): JSX.Element {
    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const statusStyles: ILabelStyles = {
                    root: {
                        color:
                            props.status?.isError ?? false ? (theme ? theme.palette.red : "rgb(128, 0, 0)") : undefined,
                    },
                };

                return (
                    <>
                        <FilePicker {...props}>
                            <Label styles={statusStyles}>{props.status?.status}</Label>
                            {props.children}
                        </FilePicker>
                    </>
                );
            }}
        </ThemeContext.Consumer>
    );
});

export interface IFilePickerWithStatusProps extends IFilePickerProps {
    status: IStatus | undefined;
}
