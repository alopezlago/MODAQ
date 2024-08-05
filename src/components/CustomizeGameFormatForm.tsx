import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    Stack,
    StackItem,
    PivotItem,
    Pivot,
    Checkbox,
    IPivotStyles,
    IStackTokens,
    SpinButton,
    TextField,
} from "@fluentui/react";
import * as CustomizeGameFormatFormController from "./CustomizeGameFormatFormController";
import { AppState } from "../state/AppState";
import { IGameFormat } from "../state/IGameFormat";
import { CustomizeGameFormatState } from "../state/CustomizeGameFormatState";
import { StateContext } from "../contexts/StateContext";
import { GameFormatPicker } from "./GameFormatPicker";
import { SheetType } from "../state/SheetState";

export const pivotStyles: Partial<IPivotStyles> = {
    root: {
        marginBottom: 10,
    },
};

const settingsStackTokens: Partial<IStackTokens> = { childrenGap: 10 };

export const CustomizeGameFormatForm = observer(function CustomizeGameFormatDialogBody(
    props: ICustomizeGameFormatFormProps
): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const customizeGameFormatState: CustomizeGameFormatState | undefined = props.state;

    const resetGameFormat = React.useCallback(
        (gameFormat: IGameFormat) => CustomizeGameFormatFormController.resetGameFormat(props.state, gameFormat),
        [props.state]
    );

    if (customizeGameFormatState == undefined) {
        return <></>;
    }

    const gameFormat: IGameFormat | undefined = customizeGameFormatState.gameFormat;
    const settingsProps: ISettingProps = { appState, state: props.state, gameFormat };

    return (
        <Stack>
            <StackItem>
                <GameFormatPicker
                    gameFormat={gameFormat}
                    exportFormatSupportsBouncebacks={
                        appState.uiState.sheetsState.sheetType !== SheetType.UCSDSheets &&
                        appState.uiState.sheetsState.sheetType !== SheetType.Lifsheets
                    }
                    updateGameFormat={resetGameFormat}
                />
            </StackItem>
            <StackItem>
                <Pivot styles={pivotStyles}>
                    <PivotItem headerText="Game Length" itemKey="GL">
                        <GameLengthSettings {...settingsProps} />
                    </PivotItem>
                    <PivotItem headerText="Scoring" itemKey="S">
                        <ScoringSettings {...settingsProps} />
                    </PivotItem>
                    <PivotItem headerText="Bonuses" itemKey="B">
                        <BonusSettings {...settingsProps} />
                    </PivotItem>
                </Pivot>
            </StackItem>
        </Stack>
    );
});

const GameLengthSettings = observer(function GameLengthSettings(props: ISettingProps): JSX.Element {
    const { state, gameFormat } = props;

    const regulationTossupCountChangeHandler = React.useCallback(
        (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) =>
            CustomizeGameFormatFormController.changeRegulationTossupCount(state, newValue),
        [state]
    );

    const minimumQuestionsInOvertimeChangeHandler = React.useCallback(
        (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) =>
            CustomizeGameFormatFormController.changeMinimumQuestionsInOvertime(state, newValue),
        [state]
    );

    return (
        <Stack tokens={settingsStackTokens}>
            <StackItem>
                <SpinButton
                    label="Tossups in regulation"
                    onChange={regulationTossupCountChangeHandler}
                    value={gameFormat.regulationTossupCount.toString()}
                    min={1}
                    max={999}
                    incrementButtonAriaLabel={"Increase number of tossups in regulation by 1"}
                    decrementButtonAriaLabel={"Decrease number of tossups in regulation by 1"}
                />
            </StackItem>
            <StackItem>
                <SpinButton
                    label="Minimum number of questions in overtime"
                    onChange={minimumQuestionsInOvertimeChangeHandler}
                    value={gameFormat.minimumOvertimeQuestionCount.toString()}
                    min={1}
                    max={99}
                    incrementButtonAriaLabel={"Increase minimum number of questions in overtime by 1"}
                    decrementButtonAriaLabel={"Decrease minimum number of questions in overtime by 1"}
                />
            </StackItem>
        </Stack>
    );
});

const ScoringSettings = observer(function ScoringSettings(props: ISettingProps): JSX.Element {
    const { state, gameFormat } = props;

    const negValueChangeHandler = React.useCallback(
        (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) =>
            CustomizeGameFormatFormController.changeNegValue(state, newValue),
        [state]
    );

    const powerMarkersHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            CustomizeGameFormatFormController.changePowerMarkers(state, newValue),
        [state]
    );

    const powerValuesHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            CustomizeGameFormatFormController.changePowerValues(state, newValue),
        [state]
    );

    const pronunciationGuideMarkersHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            CustomizeGameFormatFormController.changePronunciationGuideMarkers(state, newValue),
        [state]
    );

    const powerValidationHandler = React.useCallback(
        () => CustomizeGameFormatFormController.validatePowerSettings(state),
        [state]
    );

    const pronunicationGuideMarkersValidationHandler = React.useCallback(
        () => CustomizeGameFormatFormController.validatePronunicationGuideMarker(state),
        [state]
    );

    if (state === undefined) {
        return <></>;
    }

    return (
        <Stack tokens={settingsStackTokens}>
            <StackItem>
                <SpinButton
                    label="Neg value"
                    onChange={negValueChangeHandler}
                    value={gameFormat.negValue.toString()}
                    min={-100}
                    max={0}
                    step={5}
                    incrementButtonAriaLabel={"Increase neg value by 5"}
                    decrementButtonAriaLabel={"Decrease neg value by 5"}
                />
            </StackItem>
            <StackItem>
                <TextField
                    errorMessage={state.powerMarkerErrorMessage}
                    label="Power markers (comma separated)"
                    onBlur={powerValidationHandler}
                    onChange={powerMarkersHandler}
                    value={state.powerMarkers.join(",")}
                />
            </StackItem>
            <StackItem>
                <TextField
                    value={state.powerValues}
                    errorMessage={state.powerValuesErrorMessage}
                    label="Power values (comma separated, descending order)"
                    onBlur={powerValidationHandler}
                    onChange={powerValuesHandler}
                />
            </StackItem>
            <StackItem>
                <TextField
                    value={state.pronunicationGuideMarkers?.join(",") ?? ""}
                    errorMessage={state.pronunciationGuideMarkersErrorMessage}
                    label="Pronunciation marker start and end (comma separated)"
                    onBlur={pronunicationGuideMarkersValidationHandler}
                    onChange={pronunciationGuideMarkersHandler}
                />
            </StackItem>
        </Stack>
    );
});

const BonusSettings = observer(function BonusSettings(props: ISettingProps): JSX.Element {
    const { state } = props;

    const bouncebackChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLInputElement | HTMLElement>, checked?: boolean) =>
            CustomizeGameFormatFormController.changeBounceback(state, checked),
        [state]
    );

    const overtimeBonusesChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLInputElement | HTMLElement>, checked?: boolean) =>
            CustomizeGameFormatFormController.changeOvertimeBonuses(state, checked),
        [state]
    );

    const pairTossupsBonusesChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLInputElement | HTMLElement>, checked?: boolean) =>
            CustomizeGameFormatFormController.changePairTossupsBonuses(state, checked),
        [state]
    );

    return (
        <Stack tokens={settingsStackTokens}>
            <StackItem>
                <Checkbox
                    label="Bonuses bounce back"
                    checked={props.gameFormat.bonusesBounceBack}
                    onChange={bouncebackChangeHandler}
                />
            </StackItem>
            <StackItem>
                <Checkbox
                    label="Overtime includes bonuses"
                    checked={props.gameFormat.overtimeIncludesBonuses}
                    onChange={overtimeBonusesChangeHandler}
                />
            </StackItem>
            <StackItem>
                <Checkbox
                    label="Pair tossups with bonuses"
                    checked={props.gameFormat.pairTossupsBonuses}
                    onChange={pairTossupsBonusesChangeHandler}
                />
            </StackItem>
        </Stack>
    );
});

// TODO: Consider doing some of the parsing here
export interface ICustomizeGameFormatFormProps {
    state: CustomizeGameFormatState;
}

interface ISettingProps {
    appState: AppState;
    state: CustomizeGameFormatState;
    gameFormat: IGameFormat;
}
