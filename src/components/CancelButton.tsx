import * as React from "react";
import { observer } from "mobx-react-lite";

import { IIconProps, mergeStyleSets } from "@fluentui/react";
import { IconButton } from "@fluentui/react/lib/Button";
import { StateContext } from "../contexts/StateContext";
import { AppState } from "../state/AppState";

const deleteIconProps: IIconProps = { iconName: "Cancel" };

export const CancelButton = observer(function CancelButton(props: ICancelButtonProps): JSX.Element {
    const classes = getClassNames();
    const appState: AppState = React.useContext(StateContext);

    const onClick: () => void = () => {
        if (props.prompt == undefined) {
            props.onClick();
            return;
        }

        appState.uiState.dialogState.showOKCancelMessageDialog(props.prompt.title, props.prompt.message, props.onClick);
    };

    return (
        <IconButton
            ariaLabel={props.tooltip}
            className={classes.cancelButton}
            disabled={props.disabled}
            iconProps={deleteIconProps}
            title={props.tooltip}
            onClick={onClick}
        />
    );
});

export interface ICancelButtonProps {
    disabled?: boolean;
    prompt?: ICancelButtonPrompt;
    tooltip: string;
    onClick: () => void;
}

export interface ICancelButtonPrompt {
    title: string;
    message: string;
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
