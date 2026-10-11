import * as React from "react";
import { observer } from "mobx-react-lite";
import { Layer, memoizeFunction, mergeStyleSets, Theme, ThemeContext } from "@fluentui/react";

import * as ErrataPadController from "./ErrataPadController";
import { AppState } from "../state/AppState";
import { IErrataPad } from "../state/UIState";

/**
 * The errata pad: E opens it over the bottom of the window, like the player pad, with a button and a number key for
 * each common kind of error. A number notes that kind on the question being read (with where the reader was, when
 * read-along is on) and closes the pad; Shift+number, or Other, opens the errata dialog on the note to add details.
 * T and B pick the tossup or the bonus; Esc closes it.
 */
export const ErrataPad = observer(function ErrataPad(props: { appState: AppState }): JSX.Element | null {
    const appState: AppState = props.appState;
    const pad: IErrataPad | undefined = appState.uiState.errataPad;
    const notice: string | undefined = appState.uiState.errataNotice;
    const isOpen: boolean = pad != undefined;

    // A click anywhere else closes the pad, as Escape does
    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        const onPointerDown = (event: MouseEvent): void => {
            const target: Element | null = event.target instanceof Element ? event.target : null;
            if (target == null || target.closest(".ms-Layer, [role='dialog']") != null) {
                return;
            }

            ErrataPadController.hidePad(appState);
        };
        document.addEventListener("mousedown", onPointerDown, true);
        return () => document.removeEventListener("mousedown", onPointerDown, true);
    }, [isOpen, appState]);

    if (pad == undefined && notice == undefined) {
        return null;
    }

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classes: IErrataPadClassNames = getClassNames(theme);
                if (pad == undefined) {
                    return (
                        <Layer>
                            <div className={`${classes.pad} ${classes.notice}`} role="status">
                                {notice}
                            </div>
                        </Layer>
                    );
                }

                const location: string | undefined = pad.questionType === "tossup" ? pad.tossupLocation : undefined;
                return (
                    <Layer>
                        <div className={classes.pad} role="dialog" aria-label="Note an erratum">
                            <div className={classes.header}>
                                <span className={classes.title}>Erratum for</span>
                                <QuestionChoice
                                    classes={classes}
                                    label={`Tossup ${pad.tossupNumber}`}
                                    shortcut="T"
                                    checked={pad.questionType === "tossup"}
                                    onClick={() => ErrataPadController.setQuestionType(appState, "tossup")}
                                />
                                {pad.bonusNumber != undefined && (
                                    <QuestionChoice
                                        classes={classes}
                                        label={`Bonus ${pad.bonusNumber}`}
                                        shortcut="B"
                                        checked={pad.questionType === "bonus"}
                                        onClick={() => ErrataPadController.setQuestionType(appState, "bonus")}
                                    />
                                )}
                                <span className={classes.hint}>⇧+number adds details · Enter writes one out · Esc closes</span>
                                <button
                                    className={classes.closeButton}
                                    title="Close (Esc)"
                                    aria-label="Close"
                                    onMouseDown={preventFocus}
                                    onClick={() => ErrataPadController.hidePad(appState)}
                                >
                                    ✕
                                </button>
                            </div>
                            {location != undefined && <div className={classes.location}>Reader was {location}</div>}
                            <div className={classes.kinds}>
                                {ErrataPadController.errataKinds.map((kind, index) => (
                                    <button
                                        key={kind}
                                        className={classes.kind}
                                        title={
                                            index === ErrataPadController.errataKinds.length - 1
                                                ? `${kind}: describe it (${index + 1})`
                                                : `${kind} (${index + 1}; Shift+${index + 1} to add details)`
                                        }
                                        onMouseDown={preventFocus}
                                        onClick={(event) =>
                                            ErrataPadController.noteErratum(appState, index, event.shiftKey)
                                        }
                                    >
                                        <span className={classes.shortcut}>{index + 1}</span>
                                        <span>{kind}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Layer>
                );
            }}
        </ThemeContext.Consumer>
    );
});

function QuestionChoice(props: {
    classes: IErrataPadClassNames;
    label: string;
    shortcut: string;
    checked: boolean;
    onClick: () => void;
}): JSX.Element {
    const { classes } = props;
    return (
        <button
            className={props.checked ? `${classes.choice} ${classes.choiceChecked}` : classes.choice}
            aria-pressed={props.checked}
            title={`${props.label} (${props.shortcut})`}
            onMouseDown={preventFocus}
            onClick={props.onClick}
        >
            {props.label} <span className={classes.shortcut}>{props.shortcut}</span>
        </button>
    );
}

// Keep focus on the question, as the player pad does, so Space and the other shortcuts keep working
function preventFocus(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
}

interface IErrataPadClassNames {
    pad: string;
    notice: string;
    header: string;
    title: string;
    hint: string;
    closeButton: string;
    choice: string;
    choiceChecked: string;
    location: string;
    kinds: string;
    kind: string;
    shortcut: string;
}

const getClassNames = memoizeFunction(
    (theme: Theme | undefined): IErrataPadClassNames => {
        const quietColor: string = theme ? theme.palette.neutralSecondary : "gray";
        const lineColor: string = theme ? theme.palette.neutralTertiaryAlt : "lightgray";
        const accentColor: string = theme ? theme.palette.themePrimary : "rgb(0, 120, 212)";
        return mergeStyleSets({
            // At the bottom of the window, over the page, where the player pad floats
            pad: {
                position: "fixed",
                left: "50%",
                bottom: "16px",
                transform: "translateX(-50%)",
                boxSizing: "border-box",
                width: "max-content",
                maxWidth: "calc(100vw - 32px)",
                padding: "10px 14px 12px",
                borderRadius: "8px",
                background: theme ? theme.palette.white : "white",
                color: theme ? theme.palette.neutralPrimary : "black",
                border: "1px solid " + (theme ? theme.palette.neutralLight : "lightgray"),
                boxShadow: theme ? theme.effects.elevation16 : "0 6px 16px rgba(0, 0, 0, 0.2)",
                zIndex: 1000,
            },
            notice: {
                padding: "8px 14px",
                fontSize: "13px",
            },
            header: {
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "6px 8px",
                marginBottom: "8px",
            },
            title: {
                fontWeight: 600,
            },
            hint: {
                flexGrow: 1,
                textAlign: "right",
                fontSize: "12px",
                color: quietColor,
            },
            closeButton: {
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: quietColor,
                fontSize: "14px",
            },
            choice: {
                height: "26px",
                padding: "0 8px",
                borderRadius: "6px",
                border: "1px solid " + lineColor,
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
            },
            choiceChecked: {
                borderColor: accentColor,
                outline: "1px solid " + accentColor,
                fontWeight: 600,
            },
            location: {
                fontSize: "12px",
                color: quietColor,
                marginBottom: "8px",
                maxWidth: "640px",
            },
            kinds: {
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(140px, 1fr))",
                gap: "6px",
            },
            kind: {
                height: "30px",
                padding: "0 10px",
                borderRadius: "6px",
                border: "1px solid " + lineColor,
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textAlign: "left",
                selectors: { ":hover": { background: quietColor + "20" } },
            },
            shortcut: {
                fontSize: "11px",
                color: quietColor,
            },
        });
    }
);
