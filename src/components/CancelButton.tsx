import * as React from "react";
import { IIconProps } from "@fluentui/react";
import { IconButton } from "@fluentui/react/lib/Button";
import { createUseStyles } from "react-jss";

const deleteIconProps: IIconProps = { iconName: "Cancel" };

export const CancelButton = (props: ICancelButtonProps): JSX.Element => {
    const classes = useStyle();
    return (
        <IconButton
            className={classes.cancelButton}
            disabled={props.disabled}
            iconProps={deleteIconProps}
            title={props.title}
            onClick={props.onClick}
        />
    );
};

export interface ICancelButtonProps {
    disabled?: boolean;
    title: string;
    onClick: () => void;
}

interface ICancelButtonStyle {
    cancelButton: string;
}

const useStyle: (data?: unknown) => ICancelButtonStyle = createUseStyles({
    cancelButton: {
        display: "inline",
        color: "rgba(128, 0, 0, 0.25)",
        "&:hover": {
            color: "rgba(128, 0, 0, 1)",
        },
    },
});
