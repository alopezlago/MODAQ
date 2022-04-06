import React from "react";
import { observer } from "mobx-react-lite";
import { Checkbox, ICheckboxStyles } from "@fluentui/react/lib/Checkbox";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { ILabelStyles, Label, mergeStyleSets } from "@fluentui/react";

import { Player } from "src/state/TeamState";
import { CancelButton } from "./CancelButton";

const playerNameStyle: Partial<ITextFieldStyles> = {
    root: {
        minWidth: 80,
        marginRight: 20,
    },
};

const playerNameLabelStyle: Partial<ILabelStyles> = {
    root: {
        marginRight: 20,
    },
};

const starterCheckboxStyle: Partial<ICheckboxStyles> = {
    root: {
        alignItems: "center",
        marginRight: 5,
    },
};

export const PlayerEntry = observer(function PlayerEntry(props: IPlayerEntryProps)  {
    const classes: IPlayerEntryClassNames = getClassNames();

    const starterChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
            if (checked != undefined) {
                props.player.setStarterStatus(checked);
            }
        },
        [props.player]
    );

    let playerName: JSX.Element;
    let cancelButtonOrSpacer: JSX.Element | undefined;
    if (isEditablePlayerEntryProps(props)) {
        const nameChangeHandler = (ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newName?: string) => {
            if (newName != undefined) {
                props.player.setName(newName);
            }
        };
        const removeHandler = () => props.onRemovePlayerClick(props.player);

        playerName = (
            <TextField
                ariaLabel="Name"
                onChange={nameChangeHandler}
                onGetErrorMessage={props.validateName}
                required={props.required}
                styles={playerNameStyle}
                validateOnFocusOut={true}
                value={props.player.name}
            />
        );
        cancelButtonOrSpacer = props.canRemove ? (
            <CancelButton tooltip="Remove" onClick={removeHandler} />
        ) : (
            <span className={classes.spacer} />
        );
    } else {
        playerName = <Label styles={playerNameLabelStyle}>{props.player.name}</Label>;
    }

    return (
        <div className={classes.playerEntryContainer}>
            {playerName}
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

function isEditablePlayerEntryProps(props: IPlayerEntryProps): props is IEditablePlayerEntryProps {
    return props.player != undefined && (props as IEditablePlayerEntryProps).canRemove != undefined;
}

export type IPlayerEntryProps = IEditablePlayerEntryProps | IReadonlyPlayerEntryProps;

interface IEditablePlayerEntryProps extends IBasePlayerEntryProps {
    canRemove: boolean;
    required?: boolean;
    onRemovePlayerClick(player: Player): void;
    validateName(newName: string): string | undefined;
}

interface IReadonlyPlayerEntryProps extends IBasePlayerEntryProps {
    readonly: true;
}

interface IBasePlayerEntryProps {
    player: Player;
}

interface IPlayerEntryClassNames {
    playerEntryContainer: string;
    spacer: string;
}

const getClassNames = (): IPlayerEntryClassNames =>
    mergeStyleSets({
        playerEntryContainer: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            margin: "5px 0",
        },
        spacer: {
            // TODO: See if this needs to change, based on different media queries
            width: 32,
        },
    });
