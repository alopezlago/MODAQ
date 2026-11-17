import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    Callout,
    DefaultButton,
    DirectionalHint,
    IButtonStyles,
    ICalloutContentStyles,
    IconButton,
    IIconProps,
    IStackTokens,
    memoizeFunction,
    mergeStyleSets,
    Separator,
    Stack,
    StackItem,
    Text,
    Theme,
    ThemeContext,
} from "@fluentui/react";

import * as TossupQuestionController from "./TossupQuestionController";
import { Answer } from "./Answer";
import { AppState } from "../state/AppState";
import { ITossupWord, Tossup } from "../state/PacketState";
import { Player } from "../state/TeamState";

/**
 * The pad for recording a tossup buzz. It opens on a buzz -- Space, a click on a word, or E -- as a callout next to
 * the buzz point's word, so the question and bonus text don't move. Players are laid out left to right, the way they
 * sit. Each player has a correct (✓) and wrong (✗) button and a protest button; the first eight players also have
 * shortcuts (1-8 for correct, Shift+1-8 for wrong). The arrow keys move the buzz point, and the pad with it, and
 * Escape closes the pad. The tossup's answer is repeated at the bottom, so the moderator can judge from the pad.
 */
export const PlayerPad = observer(function PlayerPad(props: IPlayerPadProps): JSX.Element | null {
    const appState: AppState = props.appState;
    const uiState = appState.uiState;

    // Dereference the observables in the component body so mobx tracks them; reads inside the ThemeContext.Consumer
    // callback aren't tracked
    const wordIndex: number = uiState.selectedWordIndex;
    const isOpen: boolean = uiState.buzzPointPlacement != undefined && wordIndex >= 0 && !uiState.useBuzzMenu;

    // The callout places itself whenever it renders, but closes on a scroll or resize instead of following its word.
    // Closing would drop the buzz on a nudge of the mouse wheel, so it stays open and is rendered again to follow.
    const [, setLayoutChangeCount] = React.useState(0);
    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        const followWord = (): void => setLayoutChangeCount((count) => count + 1);
        window.addEventListener("scroll", followWord, true);
        window.addEventListener("resize", followWord);
        return () => {
            window.removeEventListener("scroll", followWord, true);
            window.removeEventListener("resize", followWord);
        };
    }, [isOpen]);

    if (!isOpen || uiState.buzzPointPlacement == undefined) {
        return null;
    }

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

                // Below the word, or above it when there's no room. The pad shows the answer itself, so it may cover
                // the one on the page. It closes itself: a recorded buzz, Escape, the close button, a click outside
                // it, another question.
                return (
                    <Callout
                        target={`.tossup span[data-index="${wordIndex}"]`}
                        directionalHint={DirectionalHint.bottomLeftEdge}
                        gapSpace={6}
                        isBeakVisible={false}
                        preventDismissOnScroll={true}
                        preventDismissOnResize={true}
                        preventDismissOnEvent={shouldStayOpen}
                        onDismiss={() => TossupQuestionController.cancelBuzzPointPlacement(appState)}
                        role="dialog"
                        ariaLabel="Record buzz"
                        styles={calloutStyles}
                    >
                        <Stack tokens={padTokens} className={classes.pad}>
                            <Stack horizontal={true} verticalAlign="center" tokens={headerTokens}>
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
                            <Stack horizontal={true} tokens={teamGapTokens}>
                                {teamNames.map((teamName, teamIndex) => (
                                    <React.Fragment key={teamName}>
                                        {teamIndex > 0 ? (
                                            <Separator vertical={true} styles={separatorStyles} />
                                        ) : undefined}
                                        <Stack tokens={seatGapTokens} className={classes.team}>
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
                                    </React.Fragment>
                                ))}
                            </Stack>
                            <div className={classes.answer}>
                                <Answer text={props.tossup.answer} />
                            </div>
                        </Stack>
                    </Callout>
                );
            }}
        </ThemeContext.Consumer>
    );
});

// Clicks and focus that shouldn't close the pad: on a word of the question (that moves the buzz point, and the pad
// with it, whether by a click or the arrow keys), and in another layer or dialog, which the pad may have opened
function shouldStayOpen(event: Event | React.SyntheticEvent): boolean {
    const target: EventTarget | null = event.target;
    return target instanceof Element && target.closest(".ms-Layer, [role='dialog'], .tossup span[data-index]") != null;
}

// Don't let the pad's buttons take focus on click: a focused button would also be pressed by Space, the buzz
// shortcut, and focus would leave the question
function preventFocus(event: React.MouseEvent<unknown>): void {
    event.preventDefault();
}

const closeIconProps: IIconProps = { iconName: "Cancel" };
const calloutStyles: Partial<ICalloutContentStyles> = { calloutMain: { borderRadius: 4 } };
const separatorStyles = { root: { padding: 0 } };
const padTokens: IStackTokens = { childrenGap: 8 };
const headerTokens: IStackTokens = { childrenGap: 12 };
const teamGapTokens: IStackTokens = { childrenGap: 12 };
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
                width: "max-content",
                maxWidth: "calc(100vw - 16px)",
                padding: "10px 14px 12px",
            },
            quiet: {
                color: quietColor,
            },
            team: {
                flex: "0 1 auto",
                minWidth: 0,
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
                marginTop: "2px",
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
