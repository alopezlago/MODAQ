import * as React from "react";
import { observer } from "mobx-react-lite";
import { Callout, DirectionalHint, Layer, memoizeFunction, mergeStyleSets, Theme, ThemeContext } from "@fluentui/react";

import * as TossupQuestionController from "./TossupQuestionController";
import { AppState } from "../state/AppState";
import { ITossupWord, Tossup } from "../state/PacketState";
import { Player } from "../state/TeamState";

/**
 * The floating pad for recording a tossup buzz. Players are laid out left to right, the way they sit. It opens on a buzz -- Space, a click on a word, or E -- with the
 * buzz point on a word, and floats over the page so the question and bonus text don't move: next to the word when
 * it was clicked (a short mouse move to the buttons), otherwise at the bottom of the window. Each player has a correct (✓) and wrong (✗) button and a protest button; the first eight
 * players also have shortcuts (1-8 for correct, Shift+1-8 for wrong). The arrow keys move the buzz point and
 * Escape closes the pad.
 */
export const PlayerPad = observer(function PlayerPad(props: IPlayerPadProps): JSX.Element | null {
    const appState: AppState = props.appState;
    const uiState = appState.uiState;

    // Dereference the observables in the component body so mobx tracks them; reads inside the ThemeContext.Consumer
    // callback aren't tracked
    const wordIndex: number = uiState.selectedWordIndex;
    if (uiState.buzzPointPlacement == undefined || wordIndex < 0) {
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
                        <div className={classes.header}>
                            <span className={classes.title}>
                                Buzz on <strong>{word}</strong>
                            </span>
                            <span className={classes.hint}>← → ↑ ↓ move · Esc closes</span>
                            <button
                                className={classes.closeButton}
                                title="Close (Esc)"
                                aria-label="Close"
                                onMouseDown={preventFocus}
                                onClick={() => TossupQuestionController.cancelBuzzPointPlacement(appState)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className={classes.teams}>
                            {teamNames.map((teamName) => (
                                <div key={teamName} className={classes.team}>
                                    <div className={classes.teamName}>{teamName}</div>
                                    <div className={classes.seats}>
                                        {rows
                                            .filter((row) => row.player.teamName === teamName)
                                            .map((row) => (
                                                <PlayerPadSeat
                                                    key={`${teamName}_${row.index}`}
                                                    appState={appState}
                                                    classes={classes}
                                                    row={row}
                                                    isTeamOut={teamsWithWrongBuzz.has(teamName)}
                                                />
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

                // A Callout follows the word as the arrow keys move the buzz point. The pad closes itself (a
                // recorded buzz, Escape, the close button, another question), so clicks elsewhere don't dismiss it.
                return anchoredToWord ? (
                    <Callout
                        target={`.tossup span[data-index="${wordIndex}"]`}
                        directionalHint={DirectionalHint.bottomLeftEdge}
                        gapSpace={6}
                        isBeakVisible={false}
                        setInitialFocus={false}
                        preventDismissOnLostFocus={true}
                        preventDismissOnScroll={true}
                        preventDismissOnResize={true}
                    >
                        {pad}
                    </Callout>
                ) : (
                    <Layer>{pad}</Layer>
                );
            }}
        </ThemeContext.Consumer>
    );
});

// Don't let the pad's buttons take focus on click: a focused button would also be pressed by Space, the buzz
// shortcut, and focus would leave the question
function preventFocus(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
}

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
    const { appState, classes, row } = props;
    const shortcut: string | undefined =
        row.index < TossupQuestionController.maximumPlayerPadShortcuts ? String(row.index + 1) : undefined;
    const hasBuzz: boolean = row.buzzPosition >= 0;

    return (
        <div className={props.isTeamOut && !hasBuzz ? `${classes.seat} ${classes.seatOut}` : classes.seat}>
            <span className={classes.playerName} title={row.player.name}>
                {row.player.name}
            </span>
            <button
                className={`${classes.button} ${classes.correctButton} ${row.isCorrect ? classes.correctChecked : ""}`}
                title={`${row.isCorrect ? "Remove correct buzz" : "Correct"}${
                    shortcut != undefined ? ` (${shortcut})` : ""
                }`}
                aria-pressed={row.isCorrect}
                onMouseDown={preventFocus}
                onClick={() => TossupQuestionController.recordPlayerPadBuzz(appState, row.index, /* isCorrect */ true)}
            >
                <span>✓</span>
                {shortcut != undefined ? <span className={classes.shortcut}>{shortcut}</span> : undefined}
            </button>
            <button
                className={`${classes.button} ${classes.wrongButton} ${row.isWrong ? classes.wrongChecked : ""}`}
                title={`${row.isWrong ? "Remove wrong buzz" : "Wrong"}${
                    shortcut != undefined ? ` (Shift+${shortcut})` : ""
                }`}
                aria-pressed={row.isWrong}
                onMouseDown={preventFocus}
                onClick={() => TossupQuestionController.recordPlayerPadBuzz(appState, row.index, /* isCorrect */ false)}
            >
                <span>✗</span>
                {shortcut != undefined ? (
                    <span className={classes.shortcut}>
                        <ShiftIcon />
                        {shortcut}
                    </span>
                ) : undefined}
            </button>
            <button
                className={`${classes.button} ${classes.protestButton} ${
                    hasBuzz && row.hasProtest ? classes.protestChecked : ""
                }`}
                title={
                    hasBuzz
                        ? row.hasProtest
                            ? "Remove protest"
                            : "Protest this buzz"
                        : "Only a player who buzzed can protest"
                }
                aria-pressed={hasBuzz && row.hasProtest}
                disabled={!hasBuzz}
                onMouseDown={preventFocus}
                onClick={() => TossupQuestionController.togglePlayerPadProtest(appState, row.index)}
            >
                Protest
            </button>
        </div>
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
    row: IPlayerPadRow;

    /** The player's team already buzzed wrong on this tossup */
    isTeamOut: boolean;
}

interface IPlayerPadClassNames {
    pad: string;
    floatingPad: string;
    header: string;
    title: string;
    hint: string;
    closeButton: string;
    teams: string;
    team: string;
    teamName: string;
    seats: string;
    seat: string;
    seatOut: string;
    playerName: string;
    button: string;
    correctButton: string;
    correctChecked: string;
    wrongButton: string;
    wrongChecked: string;
    protestButton: string;
    protestChecked: string;
    shortcut: string;
}

const getClassNames = memoizeFunction(
    (theme: Theme | undefined): IPlayerPadClassNames => {
        const correctColor: string = theme ? theme.palette.green : "rgb(16, 124, 16)";
        const wrongColor: string = theme ? theme.palette.red : "rgb(232, 17, 35)";
        const quietColor: string = theme ? theme.palette.neutralSecondary : "gray";
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
                border: "1px solid " + (theme ? theme.palette.neutralLight : "lightgray"),
                boxShadow: theme ? theme.effects.elevation16 : "0 6px 16px rgba(0, 0, 0, 0.2)",
                zIndex: 1000,
            },
            header: {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "8px",
            },
            title: {
                flexGrow: 1,
            },
            hint: {
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
            // Team 1 on the left, Team 2 on the right, with a rule between them, always on one line (eight players
            // fit in about 700px); on a narrower window the seats shrink rather than wrap
            teams: {
                display: "flex",
                flexWrap: "nowrap",
            },
            team: {
                display: "flex",
                flexDirection: "column",
                flex: "0 1 auto",
                minWidth: 0,
                gap: "6px",
                padding: "0 12px",
                selectors: {
                    ":first-child": { paddingLeft: 0 },
                    ":not(:first-child)": {
                        borderLeft: "1px solid " + (theme ? theme.palette.neutralLight : "lightgray"),
                    },
                },
            },
            teamName: {
                fontWeight: 600,
                color: theme ? theme.palette.themePrimary : "rgb(0, 120, 212)",
            },
            seats: {
                display: "flex",
                flexWrap: "nowrap",
                gap: "6px",
                minWidth: 0,
            },
            seat: {
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: "5px",
                flex: "0 1 76px",
                minWidth: "56px",
                boxSizing: "border-box",
                padding: "6px",
                borderRadius: "8px",
                border: "1px solid " + (theme ? theme.palette.neutralLight : "lightgray"),
            },
            seatOut: {
                opacity: 0.45,
            },
            playerName: {
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            },
            button: {
                width: "100%",
                height: "26px",
                padding: "0 6px",
                borderRadius: "6px",
                borderWidth: "1px",
                borderStyle: "solid",
                background: "transparent",
                cursor: "pointer",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "4px",
                selectors: { ":disabled": { cursor: "default", opacity: 0.4 } },
            },
            correctButton: {
                borderColor: correctColor,
                color: correctColor,
                selectors: { ":hover:enabled": { background: correctColor + "20" } },
            },
            correctChecked: {
                background: correctColor + "30",
            },
            wrongButton: {
                borderColor: wrongColor,
                color: wrongColor,
                selectors: { ":hover:enabled": { background: wrongColor + "20" } },
            },
            wrongChecked: {
                background: wrongColor + "30",
            },
            protestButton: {
                justifyContent: "center",
                height: "22px",
                fontSize: "11px",
                borderColor: quietColor,
                color: theme ? theme.palette.neutralPrimary : "black",
                selectors: { ":hover:enabled": { background: quietColor + "20" } },
            },
            protestChecked: {
                background: quietColor + "30",
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
