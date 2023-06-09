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

import * as FontDialogController from "./FontDialogController";
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

const fonts: string[] = getAvailableFonts([
    "Arial",
    "Century Schoolbook L",
    "Consolas",
    "Courier New",
    "Garamond",
    "Georgia",
    "Helvetica",
    "Liberation Serif",
    "Palatino",
    "serif",
    "Segoe UI",
    "Tahoma",
    "Times New Roman",
    "Verdana",
]);

const minimumFontSize = 12;
const maximumFontSize = 40;

const stackTokens: Partial<IStackTokens> = { childrenGap: 10 };

export const FontDialog = observer(function FontDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    return (
        <Dialog
            hidden={appState.uiState.pendingFontSize == undefined}
            dialogContentProps={content}
            modalProps={modalProps}
            maxWidth="40vw"
            onDismiss={FontDialogController.cancel}
        >
            <FontDialogBody />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={FontDialogController.update} />
                <DefaultButton text="Cancel" onClick={FontDialogController.cancel} />
            </DialogFooter>
        </Dialog>
    );
});

const FontDialogBody = observer(function FontDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const value: string = (appState.uiState.pendingFontSize ?? appState.uiState.questionFontSize).toString();

    let fontSelected = false;
    const fontOptions: IDropdownOption[] = fonts.map((font) => {
        // fontFamily has several fonts, but the one we choose should be the primary font, so look for that
        const selected: boolean = appState.uiState.pendingFontFamily
            ? appState.uiState.pendingFontFamily.startsWith(font)
            : appState.uiState.fontFamily.startsWith(font);
        fontSelected = fontSelected || selected;

        return {
            key: font,
            text: font,
            selected,
        };
    });

    if (!fontSelected && fontOptions.length > 0) {
        fontOptions[0].selected = true;
    }

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
                        FontDialogController.changeFontFamily(option?.text);
                    }}
                />
            </StackItem>
            <StackItem>
                <SpinButton
                    label="Font size"
                    onChange={changeFontSize}
                    value={value}
                    min={minimumFontSize}
                    max={maximumFontSize}
                    step={1}
                    incrementButtonAriaLabel={"Increase font size by 1"}
                    decrementButtonAriaLabel={"Decrease font size by 1"}
                />
            </StackItem>
            <StackItem>
                <span
                    style={{
                        fontFamily: appState.uiState.pendingFontFamily ?? appState.uiState.fontFamily,
                        fontSize: appState.uiState.pendingFontSize ?? appState.uiState.questionFontSize,
                    }}
                >
                    Sample text.
                </span>
            </StackItem>
        </Stack>
    );
});

function changeFontSize(event: React.SyntheticEvent<HTMLElement, Event>, newValue?: string | undefined): void {
    if (newValue == undefined) {
        return;
    }

    const size = Number.parseInt(newValue, 10);
    if (!isNaN(size)) {
        FontDialogController.changePendingSize(newValue);
    }
}

// Returns only the fonts that don't fallback to the system default
// Based off of https://www.samclarke.com/javascript-is-font-available/
function getAvailableFonts(fonts: string[]): string[] {
    // This creates an element with a large string outside of the view of the browser
    const container = document.createElement("span");
    container.innerHTML = Array(100).join("wi");
    container.style.cssText = ["position:absolute", "width:auto", "font-size:128px", "left:-99999px"].join(
        " !important;"
    );

    document.body.append(container);

    // We're never using a fantasy font like Papyrus, so check if we use the fallback font
    container.style.fontFamily = "fantasy";
    const defaultFontWidth = container.clientWidth;
    const availableFonts: string[] = fonts.filter((font) => {
        container.style.fontFamily = `${font}, fantasy`;
        return container.clientWidth !== defaultFontWidth;
    });

    document.body.removeChild(container);

    return availableFonts;
}
