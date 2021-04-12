import * as React from "react";
import { observer } from "mobx-react-lite";
import { Dropdown, IDropdownOption, IDropdownStyles, Stack, StackItem, Text } from "@fluentui/react";

import * as GameFormats from "src/state/GameFormats";
import { AppState } from "src/state/AppState";

const dropdownStyles: Partial<IDropdownStyles> = {
    root: {
        width: "20vw",
    },
};

export const GameFormatPicker = observer((props: IGameFormatPickerProps) => {
    const changeHandler = React.useCallback(
        (ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
            if (option?.data != undefined) {
                props.appState.uiState.setPendingNewGameFormat(option.data);
            }
        },
        [props]
    );

    if (props.appState.uiState.pendingNewGame == undefined) {
        return null;
    }

    const options: IDropdownOption[] = GameFormats.getKnownFormats().map((format) => {
        return {
            key: format.displayName,
            text: format.displayName,
            data: format,
            selected: props.appState.uiState.pendingNewGame?.gameFormat.displayName === format.displayName,
        };
    });

    return (
        <Stack horizontal={true}>
            <StackItem>
                <Dropdown label="Format" options={options} onChange={changeHandler} styles={dropdownStyles} />
            </StackItem>
            <StackItem>
                <ul>
                    <li>
                        <Text>{`Tossups in regulation: ${props.appState.uiState.pendingNewGame.gameFormat.regulationTossupCount}`}</Text>
                    </li>
                    <li>
                        <Text>{`Neg value: ${props.appState.uiState.pendingNewGame.gameFormat.negValue}`}</Text>
                    </li>
                    <li>
                        <Text>{`Has powers: ${
                            props.appState.uiState.pendingNewGame.gameFormat.powerMarkers.length > 0 ? "Yes" : "No"
                        }`}</Text>
                    </li>
                </ul>
            </StackItem>
        </Stack>
    );
});

export interface IGameFormatPickerProps {
    appState: AppState;
}
