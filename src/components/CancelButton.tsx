import * as React from "react";
import { observer } from "mobx-react-lite";

import { IIconProps, ITheme, memoizeFunction, mergeStyleSets, ThemeContext } from "@fluentui/react";
import { IconButton } from "@fluentui/react/lib/Button";
import { StateContext } from "../contexts/StateContext";
import { AppState } from "../state/AppState";

const deleteIconProps: IIconProps = { iconName: "Cancel" };

export const CancelButton = observer(function CancelButton(props: ICancelButtonProps): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const onClick: () => void = () => {
        if (props.prompt == undefined) {
            props.onClick();
            return;
        }

        appState.uiState.dialogState.showOKCancelMessageDialog(props.prompt.title, props.prompt.message, props.onClick);
    };

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classes = getClassNames(theme);

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
            }}
        </ThemeContext.Consumer>
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

const getClassNames = memoizeFunction(
    (theme: ITheme | undefined): ICancelButtonClassNames =>
        mergeStyleSets({
            cancelButton: {
                display: "inline",
                color: theme ? theme.palette.red : "rgba(128, 0, 0)",
                opacity: 0.6,
                "&:hover": {
                    color: theme ? theme.palette.red : "rgba(128, 0, 0)",
                    opacity: 1,
                },
            },
        })
);
