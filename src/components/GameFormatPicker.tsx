import * as React from "react";
import { observer } from "mobx-react-lite";
import { Dropdown, IDropdownOption, IDropdownStyles, ITextStyles, Stack, StackItem, Text } from "@fluentui/react";

import * as GameFormats from "src/state/GameFormats";
import { AppState } from "src/state/AppState";
import { IPendingNewGame, PendingGameType } from "src/state/IPendingNewGame";

const dropdownStyles: Partial<IDropdownStyles> = {
    root: {
        width: "20vw",
    },
};

const bouncebackWarningStyles: Partial<ITextStyles> = {
    root: {
        color: "rgb(128, 0, 0)",
        display: "block",
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

    const pendingNewGame: IPendingNewGame | undefined = props.appState.uiState.pendingNewGame;

    if (pendingNewGame == undefined) {
        return null;
    }

    const options: IDropdownOption[] = GameFormats.getKnownFormats().map((format) => {
        return {
            key: format.displayName,
            text: format.displayName,
            data: format,
            selected: pendingNewGame.gameFormat.displayName === format.displayName,
        };
    });

    const bouncebackWarning: React.ReactElement | undefined =
        pendingNewGame.gameFormat.bonusesBounceBack &&
        (pendingNewGame.type === PendingGameType.Lifsheets || pendingNewGame.type === PendingGameType.UCSDSheets) ? (
            <Text styles={bouncebackWarningStyles}>{"Note: This sheet type doesn't support bouncebacks"}</Text>
        ) : undefined;

    return (
        <Stack horizontal={true}>
            <StackItem>
                <Dropdown label="Format" options={options} onChange={changeHandler} styles={dropdownStyles} />
            </StackItem>
            <StackItem>
                <ul>
                    <li>
                        <Text>{`Tossups in regulation: ${pendingNewGame.gameFormat.regulationTossupCount}`}</Text>
                    </li>
                    <li>
                        <Text>{`Neg value: ${pendingNewGame.gameFormat.negValue}`}</Text>
                    </li>
                    <li>
                        <Text>{`Has powers: ${formatBoolean(pendingNewGame.gameFormat.powerMarkers.length > 0)}`}</Text>
                    </li>
                    <li>
                        <Text>{`Bonuses bounce back: ${formatBoolean(
                            pendingNewGame.gameFormat.bonusesBounceBack
                        )}`}</Text>
                        {bouncebackWarning}
                    </li>
                </ul>
            </StackItem>
        </Stack>
    );
});

function formatBoolean(value: boolean): string {
    return value ? "Yes" : "No";
}

export interface IGameFormatPickerProps {
    appState: AppState;
}
