import React from "react";
import { observer } from "mobx-react-lite";
import {
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    ContextualMenu,
    DialogType,
    IDialogContentProps,
    IModalProps,
    SpinButton,
    Dropdown,
    IDropdownOption,
    Stack,
    StackItem,
    IStackTokens,
    Label,
} from "@fluentui/react";
import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Font",
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
            top: "25vh",
        },
    },
    topOffsetFixed: true,
};

const defaultFont = "Segoe UI";

const fonts: string[] = ["Arial", "Consolas", "Helvetica", "Times New Roman", "Segoe UI"];

const minimumFontSize = 12;
const maximumFontSize = 40;

const stackTokens: Partial<IStackTokens> = { childrenGap: 10 };

export const FontDialog = observer(function FontDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const closeHandler = React.useCallback(() => hideDialog(appState), [appState]);
    const submitHandler = React.useCallback(() => updateFont(appState), [appState]);

    return (
        <Dialog
            hidden={appState.uiState.pendingFontSize == undefined}
            dialogContentProps={content}
            modalProps={modalProps}
            maxWidth="40vw"
            onDismiss={closeHandler}
        >
            <FontDialogBody />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={submitHandler} />
                <DefaultButton text="Cancel" onClick={closeHandler} />
            </DialogFooter>
        </Dialog>
    );
});

const FontDialogBody = observer(function FontDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const fontSizeChangeHandler = React.useCallback(
        (event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined) => {
            if (newValue == undefined) {
                return;
            }

            const size = Number.parseInt(newValue, 10);
            if (!isNaN(size)) {
                appState.uiState.setPendingFontSize(size);
            }
        },
        [appState]
    );

    const value: string = (appState.uiState.pendingFontSize ?? appState.uiState.questionFontSize).toString();

    const fontOptions: IDropdownOption[] = fonts.map((font) => {
        return {
            key: font,
            text: font,
            // fontFamily has several fonts, but the one we choose should be the primary font, so look for that
            selected: appState.uiState.pendingFontFamily
                ? appState.uiState.pendingFontFamily.startsWith(font)
                : appState.uiState.fontFamily.startsWith(font),
        };
    });

    return (
        <Stack tokens={stackTokens}>
            <StackItem>
                <Dropdown
                    label="Font"
                    options={fontOptions}
                    onRenderOption={(props, defaultRender) => {
                        if (props == undefined || defaultRender == undefined) {
                            return <></>;
                        }

                        // Fall back to the default UI if it's not loaded in the system
                        return (
                            <Label key={props.key} styles={{ root: { fontFamily: props.text + ", " + defaultFont } }}>
                                {props.text}
                            </Label>
                        );
                    }}
                    onChange={(event, option) => {
                        appState.uiState.setPendingFontFamily(option?.text ?? defaultFont);
                    }}
                />
            </StackItem>
            <StackItem>
                <SpinButton
                    label="Font size"
                    onChange={fontSizeChangeHandler}
                    value={value}
                    min={minimumFontSize}
                    max={maximumFontSize}
                    step={1}
                    incrementButtonAriaLabel={"Increase font size by 1"}
                    decrementButtonAriaLabel={"Decrease font size by 1"}
                />
            </StackItem>
        </Stack>
    );
});

function updateFont(appState: AppState): void {
    appState.uiState.setFontFamily(appState.uiState.pendingFontFamily ?? defaultFont);
    appState.uiState.setQuestionFontSize(appState.uiState.pendingFontSize ?? minimumFontSize);
    hideDialog(appState);
}

function hideDialog(appState: AppState): void {
    appState.uiState.resetPendingFonts();
}
