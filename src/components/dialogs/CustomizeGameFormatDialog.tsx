import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    IDialogContentProps,
    DialogType,
    IModalProps,
    ContextualMenu,
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    Stack,
    Checkbox,
    StackItem,
    SpinButton,
    IStackTokens,
    TextField,
    PivotItem,
    Pivot,
    IPivotStyles,
} from "@fluentui/react";

import * as CustomizeGameFormatDialogController from "./CustomGameFormatDialogController";
import { AppState } from "../../state/AppState";
import { IGameFormat } from "../../state/IGameFormat";
import { CustomizeGameFormatDialogState } from "../../state/CustomizeGameFormatDialogState";
import { StateContext } from "../../contexts/StateContext";
import { GameFormatPicker } from "../GameFormatPicker";
import { SheetType } from "../../state/SheetState";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Customize Game Format",
    closeButtonAriaLabel: "Close",
    showCloseButton: true,
    styles: {
        innerContent: {
            display: "flex",
            flexDirection: "column",
            marginBottom: 30,
        },
    },
};

const modalProps: IModalProps = {
    isBlocking: false,
    dragOptions: {
        moveMenuItemText: "Move",
        closeMenuItemText: "Close",
        menu: ContextualMenu,
    },
    styles: {
        main: {
            top: "10vh",
            // To have max width respected normally, we'd need to pass in an IDialogStyleProps, but it ridiculously
            // requires you to pass in an entire theme to modify the max width. We could also use a modal, but that
            // requires building much of what Dialogs offer easily (close buttons, footer for buttons)
            minWidth: "30vw !important",
        },
    },
    topOffsetFixed: true,
};

const pivotStyles: Partial<IPivotStyles> = {
    root: {
        marginBottom: 10,
    },
};

const settingsStackTokens: Partial<IStackTokens> = { childrenGap: 10 };

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const CustomizeGameFormatDialog = observer(function CustomizeGameFormatDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const submitHandler = React.useCallback(() => CustomizeGameFormatDialogController.submit(appState), [appState]);
    const cancelHandler = React.useCallback(() => CustomizeGameFormatDialogController.cancel(appState), [appState]);

    return (
        <Dialog
            hidden={appState.uiState.dialogState.customizeGameFormat === undefined}
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={cancelHandler}
        >
            <CustomizeGameFormatDialogBody />
            <DialogFooter>
                <PrimaryButton text="Save" onClick={submitHandler} />
                <DefaultButton text="Cancel" onClick={cancelHandler} />
            </DialogFooter>
        </Dialog>
    );
});

const CustomizeGameFormatDialogBody = observer(function CustomizeGameFormatDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const customizeGameFormatState: CustomizeGameFormatDialogState | undefined =
        appState.uiState.dialogState.customizeGameFormat;

    const resetGameFormat = React.useCallback(
        (gameFormat: IGameFormat) => CustomizeGameFormatDialogController.resetGameFormat(appState, gameFormat),
        [appState]
    );

    if (customizeGameFormatState == undefined) {
        return <></>;
    }

    const gameFormat: IGameFormat | undefined = customizeGameFormatState.gameFormat;
    const settingsProps: ISettingProps = { appState, gameFormat };

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
    const { appState, gameFormat } = props;

    const regulationTossupCountChangeHandler = React.useCallback(
        (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) =>
            CustomizeGameFormatDialogController.changeRegulationTossupCount(appState, newValue),
        [appState]
    );

    const minimumQuestionsInOvertimeChangeHandler = React.useCallback(
        (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) =>
            CustomizeGameFormatDialogController.changeMinimumQuestionsInOvertime(appState, newValue),
        [appState]
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
    const { appState, gameFormat } = props;

    const negValueChangeHandler = React.useCallback(
        (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) =>
            CustomizeGameFormatDialogController.changeNegValue(appState, newValue),
        [appState]
    );

    const powerMarkersHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            CustomizeGameFormatDialogController.changePowerMarkers(appState, newValue),
        [appState]
    );

    const powerValuesHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            CustomizeGameFormatDialogController.changePowerValues(appState, newValue),
        [appState]
    );

    const pronunciationGuideMarkersHandler = React.useCallback(
        (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) =>
            CustomizeGameFormatDialogController.changePronunciationGuideMarkers(appState, newValue),
        [appState]
    );

    const powerValidationHandler = React.useCallback(
        () => CustomizeGameFormatDialogController.validatePowerSettings(appState),
        [appState]
    );

    const pronunicationGuideMarkersValidationHandler = React.useCallback(
        () => CustomizeGameFormatDialogController.validatePronunicationGuideMarker(appState),
        [appState]
    );

    const customizeGameFormatState: CustomizeGameFormatDialogState | undefined =
        appState.uiState.dialogState.customizeGameFormat;

    if (customizeGameFormatState === undefined) {
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
                    errorMessage={customizeGameFormatState.powerMarkerErrorMessage}
                    label="Power markers (comma separated)"
                    onBlur={powerValidationHandler}
                    onChange={powerMarkersHandler}
                    value={customizeGameFormatState.powerMarkers.join(",")}
                />
            </StackItem>
            <StackItem>
                <TextField
                    value={customizeGameFormatState.powerValues}
                    errorMessage={customizeGameFormatState.powerValuesErrorMessage}
                    label="Power values (comma separated, descending order)"
                    onBlur={powerValidationHandler}
                    onChange={powerValuesHandler}
                />
            </StackItem>
            <StackItem>
                <TextField
                    value={customizeGameFormatState.pronunicationGuideMarkers?.join(",") ?? ""}
                    errorMessage={customizeGameFormatState.pronunciationGuideMarkersErrorMessage}
                    label="Pronunciation marker start and end (comma separated)"
                    onBlur={pronunicationGuideMarkersValidationHandler}
                    onChange={pronunciationGuideMarkersHandler}
                />
            </StackItem>
        </Stack>
    );
});

const BonusSettings = observer(function BonusSettings(props: ISettingProps): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const bouncebackChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLInputElement | HTMLElement>, checked?: boolean) =>
            CustomizeGameFormatDialogController.changeBounceback(appState, checked),
        [appState]
    );

    const overtimeBonusesChangeHandler = React.useCallback(
        (ev?: React.FormEvent<HTMLInputElement | HTMLElement>, checked?: boolean) =>
            CustomizeGameFormatDialogController.changeOvertimeBonuses(appState, checked),
        [appState]
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
        </Stack>
    );
});

interface ISettingProps {
    appState: AppState;
    gameFormat: IGameFormat;
}
