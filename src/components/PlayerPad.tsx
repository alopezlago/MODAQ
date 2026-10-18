import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    DefaultButton,
    IButtonStyles,
    IconButton,
    IIconProps,
    IStackTokens,
    Layer,
    memoizeFunction,
    mergeStyleSets,
    Stack,
    StackItem,
    Text,
    Theme,
    ThemeContext,
} from "@fluentui/react";

import * as TossupQuestionController from "./TossupQuestionController";
import { Answer } from "./Answer";
import { choosePadPosition, IPadPosition, IPadRect } from "./PlayerPadPlacement";
import { AppState } from "../state/AppState";
import { ITossupWord, Tossup } from "../state/PacketState";
import { Player } from "../state/TeamState";

/**
 * The floating pad for recording a tossup buzz. Players are laid out left to right, the way they sit. It opens on a buzz -- Space, a click on a word, or E -- with the
 * buzz point on a word, and floats over the page so the question and bonus text don't move: next to the word when
 * it was clicked (a short mouse move to the buttons), otherwise at the bottom of the window. Each player has a correct (✓) and wrong (✗) button and a protest button; the first eight
 * players also have shortcuts (1-8 for correct, Shift+1-8 for wrong). The arrow keys move the buzz point and
 * Escape closes the pad. The tossup's answer is repeated at the bottom, so the moderator can judge from the pad.
 */
export const PlayerPad = observer(function PlayerPad(props: IPlayerPadProps): JSX.Element | null {
    const appState: AppState = props.appState;
    const uiState = appState.uiState;

    // Dereference the observables in the component body so mobx tracks them; reads inside the ThemeContext.Consumer
    // callback aren't tracked
    const wordIndex: number = uiState.selectedWordIndex;
    const isOpen: boolean = uiState.buzzPointPlacement != undefined && wordIndex >= 0 && !uiState.useBuzzMenu;

    // A click anywhere else closes the pad, as Escape does. Listening starts only once it is open, so the click that
    // opened it has already gone by. Left alone: the pad itself, a word of the question (that click moves the buzz
    // point, and the pad with it), and any other layer or dialog, which the pad may have opened.
    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        const onPointerDown = (event: MouseEvent): void => {
            const target: Element | null = event.target instanceof Element ? event.target : null;
            if (target == null || target.closest(".ms-Layer, [role='dialog'], .tossup span[data-index]") != null) {
                return;
            }

            TossupQuestionController.cancelBuzzPointPlacement(appState);
        };
        document.addEventListener("mousedown", onPointerDown, true);
        return () => document.removeEventListener("mousedown", onPointerDown, true);
    }, [isOpen, appState]);

    if (!isOpen || uiState.buzzPointPlacement == undefined) {
        return null;
    }

    const anchoredToWord: boolean = uiState.buzzPointPlacement.anchoredToWord;

    const words: ITossupWord[] = props.tossup.getWords(appState.activeGame.gameFormat).filter((word) => word.canBuzzOn);
    const word: string = words[wordIndex]?.word.map((segment) => segment.text).join("") ?? "";
    const teamNames: string[] = appState.activeGame.teamNames;
    const players: Player[] = TossupQuestionController.getOrderedPlayers(appState);
    const rows: IPlayerPadRow[] = players.map((player, index) => ({
        player,
        index,
        ...TossupQuestionController.getPlayerBuzzState(appState, player),
    }));
    const teamsWithWrongBuzz: Set<string> = new Set(
        rows.filter((row) => row.isWrong).map((row) => row.player.teamName)
    );

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classes: IPlayerPadClassNames = getClassNames(theme);
                const pad: JSX.Element = (
                    <div
                        className={anchoredToWord ? classes.pad : `${classes.pad} ${classes.floatingPad}`}
                        role="dialog"
                        aria-label="Record buzz"
                    >
                        <Stack
                            horizontal={true}
                            verticalAlign="center"
                            tokens={headerTokens}
                            className={classes.header}
                        >
                            <StackItem grow={true}>
                                <Text>
                                    Buzz on <strong>{word}</strong>
                                </Text>
                            </StackItem>
                            <Text variant="small" className={classes.quiet}>
                                ← → ↑ ↓ move · Esc closes
                            </Text>
                            <IconButton
                                iconProps={closeIconProps}
                                styles={getCloseButtonStyles(theme)}
                                title="Close (Esc)"
                                ariaLabel="Close"
                                onMouseDown={preventFocus}
                                onClick={() => TossupQuestionController.cancelBuzzPointPlacement(appState)}
                            />
                        </Stack>
                        {/* Team 1 on the left, Team 2 on the right, always on one line (eight players fit in about
                            700px); on a narrower window the seats shrink rather than wrap */}
                        <Stack horizontal={true}>
                            {teamNames.map((teamName) => (
                                <Stack key={teamName} tokens={seatGapTokens} className={classes.team}>
                                    <Text className={classes.teamName}>{teamName}</Text>
                                    <Stack horizontal={true} tokens={seatGapTokens} className={classes.seats}>
                                        {rows
                                            .filter((row) => row.player.teamName === teamName)
                                            .map((row) => (
                                                <PlayerPadSeat
                                                    key={`${teamName}_${row.index}`}
                                                    appState={appState}
                                                    classes={classes}
                                                    theme={theme}
                                                    row={row}
                                                    isTeamOut={teamsWithWrongBuzz.has(teamName)}
                                                />
                                            ))}
                                    </Stack>
                                </Stack>
                            ))}
                        </Stack>
                        <div className={classes.answer}>
                            <Answer text={props.tossup.answer} />
                        </div>
                    </div>
                );

                // Next to the word, following it as the arrow keys move the buzz point (see PlayerPadPlacement). It
                // shows the answer itself, so it may cover the one on the page. The pad closes itself (a recorded buzz, Escape, the close button, a click
                // outside it, another question).
                return anchoredToWord ? (
                    <AnchoredPad wordIndex={wordIndex} className={classes.anchoredPad}>
                        {pad}
                    </AnchoredPad>
                ) : (
                    <Layer>{pad}</Layer>
                );
            }}
        </ThemeContext.Consumer>
    );
});

// The pad opened on a word, placed by choosePadPosition and re-placed whenever the word, the page's scroll, the
// window or the pad's own size changes. It stays hidden until it has been measured once, so it never flashes over
// the page on its way to its spot.
function AnchoredPad(props: { wordIndex: number; className: string; children: React.ReactNode }): JSX.Element {
    // The element as state, not a ref: Fluent's Layer mounts its contents a moment after the first render, so a ref
    // was still empty when the first placement ran, nothing rendered again, and the pad stayed hidden for good.
    // Arriving in the page is what triggers the first placement (and the observers).
    const [element, setElement] = React.useState<HTMLDivElement | null>(null);
    const [position, setPosition] = React.useState<IPadPosition | undefined>(undefined);
    const { wordIndex } = props;

    const place = React.useCallback((): void => {
        const word: Element | null = document.querySelector(`.tossup span[data-index="${wordIndex}"]`);
        if (element == null || word == null) {
            return;
        }

        const next: IPadPosition = choosePadPosition({
            word: toRect(word.getBoundingClientRect()),
            pad: { width: element.offsetWidth, height: element.offsetHeight },
            viewport: { width: window.innerWidth, height: window.innerHeight },
        });
        setPosition((previous) =>
            previous != undefined &&
            previous.left === next.left &&
            previous.top === next.top &&
            previous.placement === next.placement
                ? previous
                : next
        );
    }, [wordIndex, element]);

    // After every render: the word may have moved, and the pad's contents (who has the buzzer) its size
    React.useLayoutEffect(place);

    React.useEffect(() => {
        // Capture, so a scrolling container around the question counts as well as the page
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
        const observer: ResizeObserver | undefined =
            typeof ResizeObserver !== "undefined" && element != null ? new ResizeObserver(() => place()) : undefined;
        if (observer != undefined && element != null) {
            observer.observe(element);
        }

        return () => {
            window.removeEventListener("scroll", place, true);
            window.removeEventListener("resize", place);
            observer?.disconnect();
        };
    }, [place, element]);

    return (
        <Layer>
            <div
                ref={setElement}
                className={props.className}
                data-placement={position?.placement}
                style={{
                    left: position?.left ?? 0,
                    top: position?.top ?? 0,
                    visibility: position == undefined ? "hidden" : "visible",
                }}
            >
                {props.children}
            </div>
        </Layer>
    );
}

function toRect(rect: DOMRect): IPadRect {
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

// Don't let the pad's buttons take focus on click: a focused button would also be pressed by Space, the buzz
// shortcut, and focus would leave the question
function preventFocus(event: React.MouseEvent<unknown>): void {
    event.preventDefault();
}

const closeIconProps: IIconProps = { iconName: "Cancel" };
const headerTokens: IStackTokens = { childrenGap: 12 };
const seatGapTokens: IStackTokens = { childrenGap: 6 };
const seatTokens: IStackTokens = { childrenGap: 5 };

// The Shift key symbol, drawn rather than typed: the ⇧ character sits off-center from the digit in most fonts
function ShiftIcon(): JSX.Element {
    return (
        <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden="true">
            <path
                d="M4.5 1L1 5h2v3.5h3V5h2z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// One player's column: their name over their correct, wrong, and protest buttons. Players are laid out left to right
// in the order they were entered in the New Game dialog, which is meant to mirror how they sit.
function PlayerPadSeat(props: IPlayerPadSeatProps): JSX.Element {
    const { appState, classes, row, theme } = props;
    const shortcut: string | undefined =
        row.index < TossupQuestionController.maximumPlayerPadShortcuts ? String(row.index + 1) : undefined;
    const hasBuzz: boolean = row.buzzPosition >= 0;

    return (
        <Stack
            tokens={seatTokens}
            className={props.isTeamOut && !hasBuzz ? `${classes.seat} ${classes.seatOut}` : classes.seat}
        >
            <Text block={true} nowrap={true} className={classes.playerName} title={row.player.name}>
                {row.player.name}
            </Text>
            <DefaultButton
                text="✓"
                toggle={true}
                checked={row.isCorrect}
                styles={getSeatButtonStyles(theme, "correct")}
                title={`${row.isCorrect ? "Remove correct buzz" : "Correct"}${
                    shortcut != undefined ? ` (${shortcut})` : ""
                }`}
                onMouseDown={preventFocus}
                onClick={() => TossupQuestionController.recordPlayerPadBuzz(appState, row.index, /* isCorrect */ true)}
            >
                {shortcut != undefined ? <span className={classes.shortcut}>{shortcut}</span> : undefined}
            </DefaultButton>
            <DefaultButton
                text="✗"
                toggle={true}
                checked={row.isWrong}
                styles={getSeatButtonStyles(theme, "wrong")}
                title={`${row.isWrong ? "Remove wrong buzz" : "Wrong"}${
                    shortcut != undefined ? ` (Shift+${shortcut})` : ""
                }`}
                onMouseDown={preventFocus}
                onClick={() => TossupQuestionController.recordPlayerPadBuzz(appState, row.index, /* isCorrect */ false)}
            >
                {shortcut != undefined ? (
                    <span className={classes.shortcut}>
                        <ShiftIcon />
                        {shortcut}
                    </span>
                ) : undefined}
            </DefaultButton>
            <DefaultButton
                text="Protest"
                toggle={true}
                checked={hasBuzz && row.hasProtest}
                disabled={!hasBuzz}
                styles={getSeatButtonStyles(theme, "protest")}
                title={
                    hasBuzz
                        ? row.hasProtest
                            ? "Remove protest"
                            : "Protest this buzz"
                        : "Only a player who buzzed can protest"
                }
                onMouseDown={preventFocus}
                onClick={() => TossupQuestionController.togglePlayerPadProtest(appState, row.index)}
            />
        </Stack>
    );
}

export interface IPlayerPadProps {
    appState: AppState;
    tossup: Tossup;
}

interface IPlayerPadRow extends TossupQuestionController.IPlayerBuzzState {
    player: Player;

    /** Index in the pad's order, which the shortcuts use */
    index: number;
}

interface IPlayerPadSeatProps {
    appState: AppState;
    classes: IPlayerPadClassNames;
    theme: Theme | undefined;
    row: IPlayerPadRow;

    /** The player's team already buzzed wrong on this tossup */
    isTeamOut: boolean;
}

interface IPlayerPadClassNames {
    pad: string;
    floatingPad: string;
    anchoredPad: string;
    header: string;
    quiet: string;
    team: string;
    teamName: string;
    seats: string;
    seat: string;
    seatOut: string;
    playerName: string;
    shortcut: string;
    answer: string;
}

type SeatButtonKind = "correct" | "wrong" | "protest";

// The seat buttons are outlined in their color (green for correct, red for wrong, gray for protest) and tinted with
// it when hovered or checked
const getSeatButtonStyles = memoizeFunction(
    (theme: Theme | undefined, kind: SeatButtonKind): IButtonStyles => {
        const color: string =
            kind === "correct"
                ? theme
                    ? theme.palette.green
                    : "rgb(16, 124, 16)"
                : kind === "wrong"
                ? theme
                    ? theme.palette.red
                    : "rgb(232, 17, 35)"
                : theme
                ? theme.palette.neutralSecondary
                : "gray";
        const textColor: string = kind === "protest" ? (theme ? theme.palette.neutralPrimary : "black") : color;
        const isProtest: boolean = kind === "protest";
        const tinted = (alpha: string) => ({ background: color + alpha, color: textColor, borderColor: color });

        return {
            root: {
                minWidth: 0,
                width: "100%",
                height: isProtest ? 22 : 26,
                minHeight: 0,
                padding: "0 6px",
                borderRadius: 6,
                borderColor: color,
                color: textColor,
                background: "transparent",
                fontSize: isProtest ? 11 : 13,
            },
            rootHovered: tinted("20"),
            rootPressed: tinted("30"),
            rootChecked: tinted("30"),
            rootCheckedHovered: tinted("40"),
            rootCheckedPressed: tinted("40"),
            rootDisabled: { background: "transparent", borderColor: color, color: textColor, opacity: 0.4 },
            // The symbol at the left edge, the shortcut at the right
            flexContainer: { width: "100%", justifyContent: isProtest ? "center" : "space-between", gap: 4 },
            textContainer: { flexGrow: 0 },
            label: { margin: 0, fontWeight: 400 },
        };
    }
);

const getCloseButtonStyles = memoizeFunction(
    (theme: Theme | undefined): IButtonStyles => ({
        root: { width: 24, height: 24, color: theme ? theme.palette.neutralSecondary : "gray" },
        icon: { fontSize: 12 },
    })
);

const getClassNames = memoizeFunction(
    (theme: Theme | undefined): IPlayerPadClassNames => {
        const quietColor: string = theme ? theme.palette.neutralSecondary : "gray";
        const ruleColor: string = theme ? theme.palette.neutralLight : "lightgray";
        return mergeStyleSets({
            pad: {
                boxSizing: "border-box",
                maxWidth: "calc(100vw - 32px)",
                padding: "10px 14px 12px",
            },
            // Floats at the bottom of the window, over the page, so the question and bonus don't reflow
            // (left: 50% alone would size the pad to the right half of the window, wrapping it, so it sizes itself to
            // its content instead)
            floatingPad: {
                position: "fixed",
                left: "50%",
                bottom: "16px",
                transform: "translateX(-50%)",
                width: "max-content",
                maxWidth: "calc(100vw - 32px)",
                borderRadius: "8px",
                background: theme ? theme.palette.white : "white",
                border: "1px solid " + ruleColor,
                boxShadow: theme ? theme.effects.elevation16 : "0 6px 16px rgba(0, 0, 0, 0.2)",
                zIndex: 1000,
            },
            // Opened on a word: placed in window coordinates by AnchoredPad, looking like the callout it replaced
            anchoredPad: {
                position: "fixed",
                width: "max-content",
                maxWidth: "calc(100vw - 16px)",
                borderRadius: "4px",
                background: theme ? theme.palette.white : "white",
                boxShadow: theme ? theme.effects.elevation16 : "0 6px 16px rgba(0, 0, 0, 0.2)",
                zIndex: 1000,
            },
            header: {
                marginBottom: "8px",
            },
            quiet: {
                color: quietColor,
            },
            // A rule between the teams
            team: {
                flex: "0 1 auto",
                minWidth: 0,
                padding: "0 12px",
                selectors: {
                    ":first-child": { paddingLeft: 0 },
                    ":not(:first-child)": { borderLeft: "1px solid " + ruleColor },
                },
            },
            teamName: {
                fontWeight: 600,
                color: theme ? theme.palette.themePrimary : "rgb(0, 120, 212)",
            },
            seats: {
                minWidth: 0,
            },
            seat: {
                flex: "0 1 76px",
                minWidth: "56px",
                boxSizing: "border-box",
                padding: "6px",
                borderRadius: "8px",
                border: "1px solid " + ruleColor,
            },
            seatOut: {
                opacity: 0.45,
            },
            playerName: {
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "center",
            },
            // Wraps to the width the seats give the pad (width 0 with a 100% minimum), so a long answer can't
            // stretch it across the window
            answer: {
                width: 0,
                minWidth: "100%",
                boxSizing: "border-box",
                marginTop: "10px",
                paddingTop: "8px",
                borderTop: "1px solid " + ruleColor,
                fontSize: "14px",
                maxHeight: "6em",
                overflowY: "auto",
            },
            shortcut: {
                display: "inline-flex",
                alignItems: "center",
                gap: "1px",
                fontSize: "11px",
                lineHeight: "11px",
                color: quietColor,
            },
        });
    }
);
