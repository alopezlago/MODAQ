import React from "react";
import { observer } from "mobx-react-lite";
import {
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    SpinButton,
    Dropdown,
    IDropdownOption,
    Stack,
    StackItem,
    IStackTokens,
    Label,
    Checkbox,
} from "@fluentui/react";

import * as FontDialogController from "./FontDialogController";
import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";
import { FontDialogState } from "../../state/FontDialogState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

const defaultFont = "Times New Roman";

const knownFonts: string[] = [
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
];

const minimumFontSize = 12;
const maximumFontSize = 40;

const stackTokens: Partial<IStackTokens> = { childrenGap: 10 };

export const FontDialog = observer(function FontDialog(): JSX.Element {
    return (
        <ModalDialog
            title="Font"
            visibilityStatus={ModalVisibilityStatus.Font}
            maxWidth="40vw"
            onDismiss={FontDialogController.cancel}
        >
            <FontDialogBody />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={FontDialogController.update} />
                <DefaultButton text="Cancel" onClick={FontDialogController.cancel} />
            </DialogFooter>
        </ModalDialog>
    );
});

// If we really want flexibility for text/pronunciation guide colors we can use a ColorPicker, but it takes up a lot of
// space and users realistically won't use most of the colors

const FontDialogBody = observer(function FontDialogBody(): JSX.Element {
    const [fonts] = React.useState(getAvailableFonts(knownFonts));

    const appState: AppState = React.useContext(StateContext);
    const dialogState: FontDialogState | undefined = appState.uiState.dialogState.fontDialog;
    if (dialogState == undefined) {
        return <></>;
    }

    const value: string = (dialogState.fontSize ?? appState.uiState.questionFontSize).toString();

    let fontSelected = false;
    const fontOptions: IDropdownOption[] = fonts.map((font) => {
        // fontFamily has several fonts, but the one we choose should be the primary font, so look for that
        const selected: boolean = dialogState.fontFamily
            ? dialogState.fontFamily.startsWith(font)
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

    const blackTextCheckbox = (
        <Checkbox
            label="Use pure black for text"
            onChange={(ev, checked) => {
                // Dark mode already uses pure white
                if (checked === true && !appState.uiState.useDarkMode) {
                    FontDialogController.changeTextColor("black");
                } else {
                    FontDialogController.changeTextColor(undefined);
                }
            }}
            checked={dialogState.textColor === "black"}
            disabled={appState.uiState.useDarkMode}
        ></Checkbox>
    );

    const textColor: string | undefined = dialogState.textColor;
    const pronunciationGuideOptions: IDropdownOption[] = [
        {
            key: "default",
            text: "Default",
            data: "#777777",
            // There are cases where the color isn't set yet, so undefined and 777777 should match with this
            selected: dialogState.pronunciationGuideColor == undefined,
        },
        {
            key: "burgundy",
            text: "Burgundy",
            data: "#770077",
        },
        {
            key: "black",
            text: "Black",
            data: "#000000",
        },
        {
            key: "darkGray",
            text: "Dark Gray",
            data: "#555555",
        },
        {
            key: "lightGray",
            text: "Light Gray",
            data: "#888888",
        },
        {
            key: "purple",
            text: "Purple",
            data: "#6666FF",
        },
        {
            key: "teal",
            text: "Teal",
            data: "#007777",
        },
    ];

    for (const option of pronunciationGuideOptions) {
        if (dialogState.pronunciationGuideColor === option.data) {
            option.selected = true;
        }
    }

    const pronunciationGuideDropdown = (
        <Dropdown
            label="Pronunciation guide color"
            options={pronunciationGuideOptions}
            onChange={(ev, option) => {
                FontDialogController.changePronunciationGuideColor(option?.data);
            }}
            onRenderItem={(props, defaultRender) => {
                if (props == undefined || defaultRender == undefined) {
                    return <></>;
                }
                const elements = defaultRender(props);
                return (
                    <Stack horizontal={true}>
                        <StackItem>
                            <div
                                key={`block_${props.key}`}
                                style={{
                                    backgroundColor: props?.data ?? dialogState.textColor,
                                    width: 36,
                                    height: "100%",
                                }}
                            ></div>
                        </StackItem>
                        <StackItem>{elements}</StackItem>
                    </Stack>
                );
            }}
        ></Dropdown>
    );

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
            <StackItem>{pronunciationGuideDropdown}</StackItem>
            <StackItem>{blackTextCheckbox}</StackItem>
            <StackItem>
                <span
                    style={{
                        fontFamily: dialogState.fontFamily ?? appState.uiState.fontFamily,
                        fontSize: dialogState.fontSize ?? appState.uiState.questionFontSize,
                        color: textColor,
                    }}
                >
                    Sample text
                </span>
                <span
                    style={{
                        fontFamily: dialogState.fontFamily ?? appState.uiState.fontFamily,
                        fontSize: dialogState.fontSize ?? appState.uiState.questionFontSize,
                        color: dialogState.pronunciationGuideColor,
                    }}
                >
                    {" "}
                    (text)
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
