import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    Dropdown,
    IDropdownOption,
    IDropdownStyles,
    ITextStyles,
    Stack,
    StackItem,
    Text,
    ThemeContext,
} from "@fluentui/react";

import * as GameFormats from "../state/GameFormats";
import { IGameFormat } from "../state/IGameFormat";

const dropdownStyles: Partial<IDropdownStyles> = {
    root: {
        width: "100%",
    },
};

export const GameFormatPicker = observer(function GameFormatPicker(props: IGameFormatPickerProps) {
    const changeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
            if (option?.data != undefined) {
                props.updateGameFormat(option.data);
            }
        },
        [props]
    );

    const options: IDropdownOption[] = GameFormats.getKnownFormats().map((format) => {
        return {
            key: format.displayName,
            text: format.displayName,
            data: format,
            selected: props.gameFormat.displayName === format.displayName,
        };
    });

    if (options.every((option) => !option.selected)) {
        // Select freeform, which should be last
        options[options.length - 1].selected = true;
    }

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const bouncebackWarningStyles: Partial<ITextStyles> = {
                    root: {
                        color: theme ? theme.palette.red : "rgb(128, 0, 0)",
                        display: "block",
                    },
                };

                const bouncebackWarning: React.ReactElement | undefined =
                    props.gameFormat.bonusesBounceBack && props.exportFormatSupportsBouncebacks === false ? (
                        <Text styles={bouncebackWarningStyles}>
                            {"Note: This sheet type doesn't support bouncebacks"}
                        </Text>
                    ) : undefined;

                return (
                    <Stack horizontal={true}>
                        <StackItem grow={2}>
                            <Dropdown
                                label="Format"
                                options={options}
                                onChange={changeHandler}
                                styles={dropdownStyles}
                            />
                        </StackItem>
                        <StackItem grow={1}>
                            <ul>
                                <li>
                                    <Text>{`Tossups in regulation: ${props.gameFormat.regulationTossupCount}`}</Text>
                                </li>
                                <li>
                                    <Text>{`Neg value: ${props.gameFormat.negValue}`}</Text>
                                </li>
                                <li>
                                    <Text>{`Has powers: ${formatBoolean(props.gameFormat.powers.length > 0)}`}</Text>
                                </li>
                                <li>
                                    <Text>{`Bonuses bounce back: ${formatBoolean(
                                        props.gameFormat.bonusesBounceBack
                                    )}`}</Text>
                                    {bouncebackWarning}
                                </li>
                            </ul>
                        </StackItem>
                    </Stack>
                );
            }}
        </ThemeContext.Consumer>
    );
});

function formatBoolean(value: boolean): string {
    return value ? "Yes" : "No";
}

export interface IGameFormatPickerProps {
    gameFormat: IGameFormat;
    exportFormatSupportsBouncebacks?: boolean;
    updateGameFormat(gameFormat: IGameFormat): void;
}
