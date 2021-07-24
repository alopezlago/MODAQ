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
    Label,
    ILabelStyles,
    TextField,
} from "@fluentui/react";

import { GameState } from "src/state/GameState";
import { AppState } from "src/state/AppState";
import { IGameFormat, IPowerMarker } from "src/state/IGameFormat";
import { CustomizeGameFormatDialogState } from "src/state/CustomizeGameFormatDialogState";
import { StateContext } from "src/contexts/StateContext";

const customFormatName = "Custom";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Customize Game Format",
    closeButtonAriaLabel: "Close",
    showCloseButton: true,
    styles: {
        innerContent: {
            display: "flex",
            flexDirection: "column",
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
        },
    },
    topOffsetFixed: true,
};

const headerStyles: Partial<ILabelStyles> = {
    root: {
        fontSize: 16,
    },
};

const settingsStackTokens: Partial<IStackTokens> = { childrenGap: 10 };

const sectionsStackTokens: Partial<IStackTokens> = { childrenGap: 20 };

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const CustomizeGameFormatDialog = observer(
    (): JSX.Element => {
        const appState: AppState = React.useContext(StateContext);
        const submitHandler = React.useCallback(() => onSubmit(appState), [appState]);
        const cancelHandler = React.useCallback(() => onCancel(appState), [appState]);

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
    }
);

const CustomizeGameFormatDialogBody = observer(
    (): JSX.Element => {
        const appState: AppState = React.useContext(StateContext);
        const customizeGameFormatState: CustomizeGameFormatDialogState | undefined =
            appState.uiState.dialogState.customizeGameFormat;

        const regulationTossupCountChangeHandler = React.useCallback(
            (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) => {
                const count: number | undefined = getNumberOrUndefined(newValue);
                if (count != undefined) {
                    customizeGameFormatState?.updateGameFormat({ regulationTossupCount: count });
                }
            },
            [customizeGameFormatState]
        );

        const negValueChangeHandler = React.useCallback(
            (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) => {
                const negValue: number | undefined = getNumberOrUndefined(newValue);
                if (negValue != undefined) {
                    customizeGameFormatState?.updateGameFormat({ negValue });
                }
            },
            [customizeGameFormatState]
        );

        const powerMarkersHandler = React.useCallback(
            (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
                if (newValue == undefined) {
                    return;
                } else if (newValue.trim() === "") {
                    customizeGameFormatState?.setPowerMarkers([]);
                    return;
                }

                // TODO: Handle power markers with commas, which would require handling escapes
                const powerMarkers: string[] = newValue.split(",").map((value) => value.trim());
                customizeGameFormatState?.setPowerMarkers(powerMarkers);
            },
            [customizeGameFormatState]
        );

        const powerValuesHandler = React.useCallback(
            (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
                if (newValue == undefined) {
                    return;
                } else if (newValue.trim() === "") {
                    customizeGameFormatState?.setPowerValues([]);
                    return;
                }

                const pointsForPowers: number[] = newValue.split(",").map((value) => parseInt(value, 10));
                if (pointsForPowers.some((value) => isNaN(value))) {
                    return;
                }

                customizeGameFormatState?.setPowerValues(pointsForPowers);
            },
            [customizeGameFormatState]
        );

        const pronunciationGuideMarkersHandler = React.useCallback(
            (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
                if (newValue == undefined || newValue.trim() === "") {
                    customizeGameFormatState?.setPronunciationGuideMarkers([]);
                    return;
                }

                const guides: string[] = newValue.split(",");
                customizeGameFormatState?.setPronunciationGuideMarkers(guides);
            },
            [customizeGameFormatState]
        );

        const minimumQuestionsInOvertimeChangeHandler = React.useCallback(
            (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) => {
                const minimumOvertimeQuestionCount: number | undefined = getNumberOrUndefined(newValue);
                if (minimumOvertimeQuestionCount != undefined) {
                    customizeGameFormatState?.updateGameFormat({ minimumOvertimeQuestionCount });
                }
            },
            [customizeGameFormatState]
        );

        const bouncebackChangeHandler = React.useCallback(
            (ev?: React.FormEvent<HTMLInputElement | HTMLElement>, checked?: boolean) => {
                if (checked == undefined) {
                    return;
                }

                customizeGameFormatState?.updateGameFormat({ bonusesBounceBack: checked });
            },
            [customizeGameFormatState]
        );

        const overtimeBonusesChangeHandler = React.useCallback(
            (ev?: React.FormEvent<HTMLInputElement | HTMLElement>, checked?: boolean) => {
                if (checked == undefined) {
                    return;
                }

                customizeGameFormatState?.updateGameFormat({ overtimeIncludesBonuses: checked });
            },
            [customizeGameFormatState]
        );

        const powerValidationHandler = React.useCallback(() => {
            if (customizeGameFormatState == undefined) {
                return;
            }

            if (customizeGameFormatState.powerMarkers.length < customizeGameFormatState.powerValues.length) {
                customizeGameFormatState.setPowerMarkerErrorMessage(
                    "More power markers needed. The number of power markers and values must be the same."
                );
            } else if (customizeGameFormatState.powerValues.length < customizeGameFormatState.powerMarkers.length) {
                customizeGameFormatState.setPowerValuesErrorMessage(
                    "More values needed. The number of power markers and values must be the same."
                );
            } else {
                customizeGameFormatState.clearPowerErrorMessages();
            }
        }, [customizeGameFormatState]);

        const pronunicationGuideMarkersValidationHandler = React.useCallback(() => {
            if (
                customizeGameFormatState == undefined ||
                customizeGameFormatState.pronunicationGuideMarkers == undefined
            ) {
                return;
            }

            const pronunciationGuideMarkers: string[] = customizeGameFormatState.pronunicationGuideMarkers;

            if (pronunciationGuideMarkers.length !== 0 && pronunciationGuideMarkers.length !== 2) {
                customizeGameFormatState.setPronunciationGuideMarkersErrorMessage(
                    "Either no pronunciation guide is used, or there only needs to be a start and end marker specifeid"
                );
            } else if (pronunciationGuideMarkers.some((value) => value.length === 0)) {
                customizeGameFormatState.setPronunciationGuideMarkersErrorMessage(
                    "Pronunciation guide markers cannot be empty; put a character before or after the comma"
                );
            } else {
                customizeGameFormatState.clearPronunciationGuideMarkersErrorMessage();
            }
        }, [customizeGameFormatState]);

        if (customizeGameFormatState == undefined) {
            return <></>;
        }

        const gameFormat: IGameFormat | undefined = customizeGameFormatState.gameFormat;

        return (
            <Stack tokens={sectionsStackTokens}>
                <StackItem>
                    <Stack tokens={settingsStackTokens}>
                        <StackItem>
                            <Label styles={headerStyles}>Game length</Label>
                        </StackItem>
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
                </StackItem>

                <StackItem>
                    <Stack tokens={settingsStackTokens}>
                        <StackItem>
                            <Label styles={headerStyles}>Scoring</Label>
                        </StackItem>
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
                                defaultValue={customizeGameFormatState.powerValues.join(",")}
                                errorMessage={customizeGameFormatState.powerValuesErrorMessage}
                                label="Power values (comma separated, descending order)"
                                onBlur={powerValidationHandler}
                                onChange={powerValuesHandler}
                            />
                        </StackItem>
                        <StackItem>
                            <TextField
                                defaultValue={customizeGameFormatState.pronunicationGuideMarkers?.join(",")}
                                errorMessage={customizeGameFormatState.pronunciationGuideMarkersErrorMessage}
                                label="Pronunciation marker start and end (comma separated)"
                                onBlur={pronunicationGuideMarkersValidationHandler}
                                onChange={pronunciationGuideMarkersHandler}
                            />
                        </StackItem>
                    </Stack>
                </StackItem>

                <StackItem>
                    <Stack tokens={settingsStackTokens}>
                        <StackItem>
                            <Label styles={headerStyles}>Bonus settings</Label>
                        </StackItem>
                        <StackItem>
                            <Checkbox
                                label="Bonuses bounce back"
                                checked={gameFormat.bonusesBounceBack}
                                onChange={bouncebackChangeHandler}
                            />
                        </StackItem>
                        <StackItem>
                            <Checkbox
                                label="Overtime includes bonuses"
                                checked={gameFormat.overtimeIncludesBonuses}
                                onChange={overtimeBonusesChangeHandler}
                            />
                        </StackItem>
                    </Stack>
                </StackItem>
            </Stack>
        );
    }
);

function getNumberOrUndefined(value: string | undefined): number | undefined {
    if (value == undefined) {
        return undefined;
    }

    const number = Number.parseInt(value, 10);
    return isNaN(number) ? undefined : number;
}

function onSubmit(appState: AppState): void {
    const game: GameState = appState.game;
    const state: CustomizeGameFormatDialogState | undefined = appState.uiState.dialogState.customizeGameFormat;
    if (state == undefined) {
        throw new Error("Tried customizing a game format with no game format");
    }

    if (!isGameFormatValid(appState)) {
        // We should already have the error repored, so just do nothing
        return;
    }

    const updatedGameFormat: IGameFormat = state.gameFormat;
    if (updatedGameFormat.displayName !== customFormatName) {
        // TS will complain about implicit any if we use Object.keys to do a deep comparison, so cast the objects as any,
        // and then do a deep comparison
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyUpdatedGameFormat: any = updatedGameFormat as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyExistingGameFormat: any = game.gameFormat as any;

        for (const key of Object.keys(updatedGameFormat)) {
            if (anyUpdatedGameFormat[key] !== anyExistingGameFormat[key]) {
                updatedGameFormat.displayName = customFormatName;
                break;
            }
        }
    }

    // Power values should be in descending order, so sort them before saving the game format
    const powers: IPowerMarker[] = [];
    for (let i = 0; i < state.powerMarkers.length; i++) {
        powers.push({ marker: state.powerMarkers[i], points: state.powerValues[i] });
    }

    powers.sort(sortPowersDescending);
    updatedGameFormat.powers = powers;

    if (state.pronunicationGuideMarkers == undefined || state.pronunicationGuideMarkers.length === 0) {
        updatedGameFormat.pronunciationGuideMarkers = undefined;
    } else if (
        state.pronunicationGuideMarkers.length === 2 &&
        state.pronunicationGuideMarkers.every((value) => value.length > 0)
    ) {
        updatedGameFormat.pronunciationGuideMarkers = [
            state.pronunicationGuideMarkers[0],
            state.pronunicationGuideMarkers[1],
        ];
    }

    game.setGameFormat(updatedGameFormat);

    hideDialog(appState);
}

function sortPowersDescending(left: IPowerMarker, right: IPowerMarker): number {
    return right.points - left.points;
}

function isGameFormatValid(appState: AppState): boolean {
    const state: CustomizeGameFormatDialogState | undefined = appState.uiState.dialogState.customizeGameFormat;
    if (state == undefined) {
        throw new Error("Tried changing a format with no modified format");
    }

    return (
        state.powerMarkerErrorMessage == undefined &&
        state.powerValuesErrorMessage == undefined &&
        state.pronunciationGuideMarkersErrorMessage == undefined
    );
}

function onCancel(appState: AppState): void {
    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    appState.uiState.dialogState.hideCustomizeGameFormatDialog();
}
