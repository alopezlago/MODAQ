import React from "react";
import { observer } from "mobx-react";
import { Checkbox, ICheckboxStyles } from "@fluentui/react/lib/Checkbox";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { createUseStyles } from "react-jss";

import { Player } from "src/state/TeamState";
import { CancelButton } from "./CancelButton";

const playerNameStyle: Partial<ITextFieldStyles> = {
    root: {
        minWidth: 80,
        maxWidth: 200,
        marginRight: 20,
    },
};

const starterCheckboxStyle: Partial<ICheckboxStyles> = {
    root: {
        alignItems: "center",
    },
};

export const PlayerEntry = observer((props: IPlayerEntryProps) => {
    const classes: IPlayerEntryStyles = useStyles();

    const nameChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newName?: string) => {
            if (newName != undefined) {
                props.player.setName(newName);
            }
        },
        [props.player]
    );
    const starterChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
            if (checked != undefined) {
                props.player.setStarterStatus(checked);
            }
        },
        [props.player]
    );
    const removeHandler = React.useCallback(() => props.onRemovePlayerClick(props.player), [props]);

    const cancelButtonOrSpacer: JSX.Element = props.canRemove ? (
        <CancelButton title="Remove" onClick={removeHandler} />
    ) : (
        <span className={classes.spacer} />
    );

    return (
        <div className={classes.playerEntryContainer}>
            <TextField
                ariaLabel="Name"
                onChange={nameChangeHandler}
                onGetErrorMessage={props.validateName}
                required={props.required}
                styles={playerNameStyle}
                validateOnFocusOut={true}
                value={props.player.name}
            />
            <Checkbox
                label="Starter"
                onChange={starterChangeHandler}
                styles={starterCheckboxStyle}
                checked={props.player.isStarter}
            />
            {cancelButtonOrSpacer}
        </div>
    );
});

export interface IPlayerEntryProps {
    canRemove: boolean;
    player: Player;
    required?: boolean;
    onRemovePlayerClick(player: Player): void;
    validateName(newName: string): string | undefined;
}

interface IPlayerEntryStyles {
    playerEntryContainer: string;
    spacer: string;
}

const useStyles: (data?: unknown) => IPlayerEntryStyles = createUseStyles({
    playerEntryContainer: {
        display: "inline-flex",
        margin: "5px 0",
    },
    spacer: {
        // TODO: See if this needs to change, based on different media queries
        width: 32,
    },
});
