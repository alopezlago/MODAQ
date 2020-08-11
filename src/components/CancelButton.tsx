import * as React from "react";
import { IIconProps, mergeStyleSets } from "@fluentui/react";
import { IconButton } from "@fluentui/react/lib/Button";

const deleteIconProps: IIconProps = { iconName: "Cancel" };

export const CancelButton = (props: ICancelButtonProps): JSX.Element => {
    const classes = getClassNames();
    return (
        <IconButton
            ariaLabel={props.title}
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

interface ICancelButtonClassNames {
    cancelButton: string;
}

const getClassNames = (): ICancelButtonClassNames =>
    mergeStyleSets({
        cancelButton: {
            display: "inline",
            color: "rgba(128, 0, 0, 0.25)",
            "&:hover": {
                color: "rgba(128, 0, 0, 1)",
            },
        },
    });
