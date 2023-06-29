import * as React from "react";
import { observer } from "mobx-react-lite";

import * as CompareUtils from "../../state/CompareUtils";
import * as FormattedTextParser from "../../parser/FormattedTextParser";
import { Cycle } from "../../state/Cycle";
import { AppState } from "../../state/AppState";
import {
    Dialog,
    DialogFooter,
    PrimaryButton,
    ContextualMenu,
    DialogType,
    IDialogContentProps,
    IModalProps,
    Stack,
    StackItem,
    ITheme,
    mergeStyleSets,
    ThemeContext,
    memoizeFunction,
} from "@fluentui/react";
import { StateContext } from "../../contexts/StateContext";
import { GameState } from "../../state/GameState";
import { Player } from "../../state/TeamState";
import { ITossupAnswerEvent } from "../../state/Events";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Scoresheet",
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
    topOffsetFixed: true,
};

// Based on the scoresheet created by Ryan Rosenberg, like the one here: https://quizbowlstats.com/games/95741
export const ScoresheetDialog = observer(function ScoresheetDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    const closeDialog = React.useCallback(() => appState.uiState.dialogState.hideScoresheetDialog(), [appState]);

    return (
        <Dialog
            hidden={!appState.uiState.dialogState.scoresheetDialogVisisble}
            maxWidth="100vw"
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={closeDialog}
        >
            <ScoresheetDialogBody appState={appState} />
            <DialogFooter>
                <PrimaryButton text="Close" onClick={closeDialog} />
            </DialogFooter>
        </Dialog>
    );
});

export const ScoresheetDialogBody = observer(function ScoresheetDialogBody(
    props: IScoresheetDialogBodyProps
): JSX.Element {
    const appState: AppState = props.appState;
    const game: GameState = appState.game;
    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classNames: IScoresheetClassNames = getClassNames(theme);
                const totalScoreClassNames = `${classNames.totalScoreCell} ${classNames.tableCell}`;
                const tuNumberClassNames = `${classNames.tableCell} ${classNames.tuNumber}`;

                const playerToStatlineMap: Map<Player, Map<number, number>> = new Map<Player, Map<number, number>>();
                const teamToPlayerMap: Map<string, Player[]> = new Map<string, Player[]>();
                const teamToActivePlayerMap: Map<string, Set<Player>> = new Map<string, Set<Player>>();
                for (const teamName of game.teamNames) {
                    teamToPlayerMap.set(teamName, []);
                    teamToActivePlayerMap.set(teamName, game.getActivePlayers(teamName, 0));
                }

                for (const player of game.players) {
                    // game.teamNames will have every team a player is on, so we know the array exists
                    (teamToPlayerMap.get(player.teamName) as Player[]).push(player);
                    playerToStatlineMap.set(player, new Map<number, number>());
                }

                const cyclesRows: JSX.Element[] = [];
                for (let i = 0; i < game.playableCycles.length; i++) {
                    let isFirstTeamName = true;
                    const cells: JSX.Element[] = [];
                    const cycle: Cycle = game.playableCycles[i];

                    for (let j = 0; j < game.teamNames.length; j++) {
                        const teamName = game.teamNames[j];
                        if (!isFirstTeamName) {
                            // Add TU number
                            const number: number = i + 1;
                            cells.push(
                                <td className={tuNumberClassNames} key={`TU_${number}`}>
                                    {number}
                                </td>
                            );
                        } else {
                            isFirstTeamName = false;
                        }

                        // We initialized this before, we'll always have the array
                        const teamPlayers: Player[] = teamToPlayerMap.get(teamName) as Player[];

                        // getActivePlayers takes O(n) where n is the cycle, so doing this each time in the loop would be
                        // quadratic. It's not too big of a hit but we do gain several ms from caching this
                        // We could make this more efficient in some cases by making sure that the team involved is
                        // in one of these events, but this shouldn't be too big of a hit
                        if (cycle.playerJoins || cycle.playerLeaves || cycle.subs) {
                            teamToActivePlayerMap.set(teamName, game.getActivePlayers(teamName, i));
                        }

                        // We know this always exists since we set it up before
                        const activeTeamPlayers: Set<Player> = teamToActivePlayerMap.get(teamName) as Set<Player>;

                        for (const player of teamPlayers) {
                            cells.push(
                                renderPlayerCell(
                                    game,
                                    player,
                                    cycle,
                                    activeTeamPlayers,
                                    playerToStatlineMap,
                                    i,
                                    classNames
                                )
                            );
                        }

                        cells.push(renderBonusCell(cycle, teamName, i, classNames));

                        cells.push(
                            <td className={totalScoreClassNames} key={`Total_${i}_${j}`}>
                                {game.scores[i][j]}
                            </td>
                        );
                    }

                    cyclesRows.push(
                        <tr className={classNames.cycleRow} key={`Row_${i}`}>
                            {cells}
                        </tr>
                    );
                }

                cyclesRows.push(renderStatlineRow(game, teamToPlayerMap, playerToStatlineMap, classNames));

                const teamTitle = game.teamNames.join(" vs. ");
                return (
                    <Stack>
                        <StackItem>
                            <h2>{teamTitle}</h2>
                        </StackItem>
                        <StackItem>
                            <table className={classNames.table}>
                                <thead className={classNames.playerRow}>
                                    <tr>{renderHeader(game, classNames)}</tr>
                                </thead>
                                <tbody>{cyclesRows}</tbody>
                            </table>
                        </StackItem>
                    </Stack>
                );
            }}
        </ThemeContext.Consumer>
    );
});

function getUnformattedAnswer(game: GameState, answer: string): string {
    // Ignore alternate answers and remove all formatting from the primary answer
    const alternateIndex = answer.indexOf("[");
    if (alternateIndex >= 0) {
        answer = answer.substring(0, alternateIndex).trim();
    }

    const text = FormattedTextParser.parseFormattedText(answer, game.gameFormat.pronunciationGuideMarkers)
        .map((line) => line.text)
        .join("");

    return text;
}

function renderBonusCell(
    cycle: Cycle,
    teamName: string,
    cycleIndex: number,
    classNames: IScoresheetClassNames
): JSX.Element {
    if (cycle.bonusAnswer && cycle.bonusAnswer.receivingTeamName === teamName) {
        // Go through each part, show check or ✓✗
        const lines = [];
        let bonusTotal = 0;
        for (let i = 0; i < cycle.bonusAnswer.parts.length; i++) {
            const part = cycle.bonusAnswer.parts[i];
            lines.push(
                part.points > 0 ? (
                    <span className={classNames.correctBonus} key={`Bonus_${cycleIndex}_${teamName}_${i}`}>
                        ✓
                    </span>
                ) : (
                    <span className={classNames.wrongBonus} key={`Bonus_${cycleIndex}_${teamName}_${i}`}>
                        ✗
                    </span>
                )
            );
            bonusTotal += part.points;
        }

        lines.push(<span key={`Bonus_${cycleIndex}_${teamName}_Total`}> {bonusTotal}</span>);

        return (
            <td className={`${classNames.bonusCell} ${classNames.tableCell}`} key={`Bonus_${cycleIndex}_${teamName}`}>
                {lines}
            </td>
        );
    }

    return <td className={`${classNames.bonusCell} ${classNames.tableCell}`} key={`Bonus_${cycleIndex}_${teamName}`} />;
}

function renderHeader(game: GameState, classNames: IScoresheetClassNames): JSX.Element[] {
    // header should be
    // first team players; Bonus; Total ; TU ; second team players; Bonus; Total
    // Because MODAQ supports non-three part bonuses we need to do checks and Xs in one cell
    const headers: JSX.Element[] = [];
    for (let i = 0; i < game.teamNames.length; i++) {
        const teamName: string = game.teamNames[i];
        const players: Player[] = game.getPlayers(teamName);
        for (const player of players) {
            headers.push(
                <th className={classNames.tableHeader} key={`${teamName}_${player.name}`}>
                    {player.name}
                </th>
            );
        }

        headers.push(
            <th className={classNames.tableHeader} key={`thBonus_${i}`}>
                Bonus
            </th>
        );
        headers.push(
            <th className={classNames.tableHeader} key={`thTotal_${i}`}>
                Total
            </th>
        );

        // Don't include the question counter on the last row (no teams after it to follow along with)
        if (i < game.teamNames.length - 1) {
            headers.push(
                <th className={classNames.tableHeader} key="thTU">
                    <h3 className={classNames.tuLabel}>TU</h3>
                </th>
            );
        }
    }

    return headers;
}

function renderPlayerCell(
    game: GameState,
    player: Player,
    cycle: Cycle,
    activeTeamPlayers: Set<Player>,
    playerToStatlineMap: Map<Player, Map<number, number>>,
    cycleIndex: number,
    classNames: IScoresheetClassNames
): JSX.Element {
    // if this is too inefficient (because we check all players for the correct buzz), move to using a map. This means
    // we need existing cells that we can overwrite. From testing, this seems to be fine.
    if (cycle.correctBuzz && CompareUtils.playersEqual(cycle.correctBuzz.marker.player, player)) {
        const correctPoints: number = cycle.correctBuzz.marker.points;
        const answer = getUnformattedAnswer(game, game.packet.tossups[cycle.correctBuzz.tossupIndex].answer);

        // We know this exists since we initialized it earlier
        const statlineMap = playerToStatlineMap.get(player) as Map<number, number>;
        const pointValueCount = statlineMap.get(correctPoints) ?? 0;
        statlineMap.set(correctPoints, pointValueCount + 1);
        return (
            <td
                className={classNames.tableCell}
                title={`TU on "${answer}" at word ${
                    cycle.correctBuzz.marker.position + 1
                } correct for ${correctPoints} points`}
                key={`correct_${cycleIndex}`}
            >
                {correctPoints}
            </td>
        );
    } else if (cycle.wrongBuzzes) {
        const wrongBuzz: ITossupAnswerEvent | undefined = cycle.wrongBuzzes.find((buzz) =>
            CompareUtils.playersEqual(buzz.marker.player, player)
        );
        if (wrongBuzz) {
            const wrongPoints: number = wrongBuzz.marker.points;
            const answer = getUnformattedAnswer(game, game.packet.tossups[wrongBuzz.tossupIndex].answer);

            // We know this exists since we initialized it earlier
            const statlineMap = playerToStatlineMap.get(player) as Map<number, number>;
            const pointValueCount = statlineMap.get(wrongPoints) ?? 0;
            statlineMap.set(wrongPoints, pointValueCount + 1);
            return (
                <td
                    className={classNames.tableCell}
                    title={`TU on "${answer}" at word ${
                        wrongBuzz.marker.position + 1
                    } incorrect for ${wrongPoints} points`}
                    key={`wrong_${player.teamName}_${player.name}_${cycleIndex}`}
                >
                    {wrongPoints}
                </td>
            );
        }
    }

    let cellClassName: string = classNames.tableCell;
    if (!activeTeamPlayers.has(player)) {
        cellClassName += " " + classNames.inactivePlayerCell;
    }

    return <td className={cellClassName} key={`empty_${player.teamName}_${player.name}`}></td>;
}

function renderStatlineRow(
    game: GameState,
    teamToPlayerMap: Map<string, Player[]>,
    playerToStatlineMap: Map<Player, Map<number, number>>,
    classNames: IScoresheetClassNames
): JSX.Element {
    const statlineCells: JSX.Element[] = [];
    let allowedTuPoints: number[] = [10];
    if (game.gameFormat.negValue < 0) {
        allowedTuPoints.push(game.gameFormat.negValue);
    }

    if (game.gameFormat.powers) {
        // powers is already in descending order, so no need to sort
        allowedTuPoints = game.gameFormat.powers.map((marker) => marker.points).concat(allowedTuPoints);
    }

    let isFirstTeamName = true;
    for (let i = 0; i < game.teamNames.length; i++) {
        const teamName = game.teamNames[i];
        if (!isFirstTeamName) {
            // Add filler cell for TU column
            statlineCells.push(
                <td className={`${classNames.tableCell} ${classNames.tuNumber}`} key="END">
                    END
                </td>
            );
        } else {
            isFirstTeamName = false;
        }

        // We initialized this before, we'll always have the array
        const teamPlayers: Player[] = teamToPlayerMap.get(teamName) as Player[];

        let tuTotal = 0;
        for (const player of teamPlayers) {
            const statlineMap = playerToStatlineMap.get(player) as Map<number, number>;
            let totalPoints = 0;
            const statline: number[] = [];
            // Order should be based on superpower/power/gets/negs, then the total
            for (const value of allowedTuPoints) {
                const valueCount: number = statlineMap.get(value) ?? 0;
                statline.push(valueCount);
                totalPoints += valueCount * value;
            }

            statlineCells.push(
                <td className={classNames.tableCell} key={`stat_${teamName}_${player.name}`}>
                    {totalPoints} ({statline.join("/")})
                </td>
            );
            tuTotal += totalPoints;
        }

        // Bonus total and total score cells
        const teamTotal = game.finalScore[i];
        statlineCells.push(
            <td className={classNames.tableCell} key={`EndBonus_${teamName}`}>
                {teamTotal - tuTotal}
            </td>
        );
        statlineCells.push(
            <td className={`${classNames.tableCell} ${classNames.totalScoreCell}`} key={`EndTotal_${teamName}`}>
                {teamTotal}
            </td>
        );
    }

    // tr needs a class to make the top border solid
    return (
        <tr className={classNames.statlineRow} key="statline">
            {statlineCells}
        </tr>
    );
}

export interface IScoresheetDialogBodyProps {
    appState: AppState;
}

interface IScoresheetClassNames {
    bonusCell: string;
    correctBonus: string;
    cycleRow: string;
    inactivePlayerCell: string;
    playerRow: string;
    statlineRow: string;
    table: string;
    tableCell: string;
    tableHeader: string;
    totalScoreCell: string;
    tuLabel: string;
    tuNumber: string;
    wrongBonus: string;
}

const getClassNames = memoizeFunction(
    (theme: ITheme | undefined): IScoresheetClassNames =>
        mergeStyleSets({
            bonusCell: {
                borderLeft: "1px solid",
                borderRight: "1px solid",
            },
            correctBonus: {
                color: theme ? theme.palette.tealLight : "rbg(0, 128, 128)",
            },
            cycleRow: {
                borderLeft: "1px solid",
                borderRight: "1px solid",
            },
            inactivePlayerCell: {
                backgroundColor: theme?.palette.neutralPrimary ?? "black",
            },
            playerRow: {
                borderBottom: "1px solid",
                margin: 0,
            },
            statlineRow: {
                border: "1px solid",
                // Have a high top-border to make it clear that this isn't another cycle row
                borderTop: "20px solid",
            },
            table: {
                borderCollapse: "collapse",
            },
            tableCell: {
                border: "1px dotted",
                textAlign: "center",
                padding: "0 2px",
            },
            tableHeader: {
                padding: "0em 0.5em",
            },
            totalScoreCell: {
                fontWeight: 500,
            },
            tuLabel: {
                marginBottom: 0,
            },
            tuNumber: {
                textAlign: "center",
                fontWeight: 700,
                borderLeft: "1px solid",
                borderRight: "1px solid",
            },
            wrongBonus: {
                color: theme ? theme.palette.red : "rbg(128, 0, 0)",
            },
        })
);
