import React from "react";
import { Icon, IIconStyles, ILabelStyles, Label, mergeStyleSets, Stack, StackItem } from "@fluentui/react";
import { observer } from "mobx-react-lite";

import { AppState } from "../state/AppState";
import { useAppState } from "../contexts/StateContext";

const labelStyles: ILabelStyles = {
    root: {
        fontSize: 18,
    },
};

const scoreCellStyle: React.CSSProperties = {
    paddingLeft: 5,
};

export const Scoreboard = observer(function Scoreboard() {
    const appState: AppState = useAppState();
    const classes: IScoreboardStyle = getClassNames();

    const finalScore: number[] = appState.game.finalScore;
    // Two teams read in game order. A room of twenty competitors (a shootout,
    // IPNCT) is a standings list, and is read as one: leader first. Ties keep
    // the order they joined in.
    let standings: { name: string; score: number }[] = appState.game.teamNames.map((name, index) => ({
        name,
        score: finalScore[index] ?? 0,
    }));
    if (appState.game.isIndividualGame) {
        standings = standings.slice().sort((a, b) => b.score - a.score);
    }

    let label: JSX.Element | undefined;
    if (appState.uiState.isScoreVertical) {
        label = (
            <table>
                <tbody>
                    {standings.map(({ name, score }) => (
                        <tr key={name}>
                            <td>
                                <Label styles={labelStyles}>{name}</Label>
                            </td>
                            <td style={scoreCellStyle}>
                                <Label styles={labelStyles}>{score}</Label>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    } else {
        label = (
            <Label styles={labelStyles}>{standings.map(({ name, score }) => `${name}: ${score}`).join(", ")}</Label>
        );
    }

    const protestIndicator = <ProtestIndicator />;
    // The stable class name lets a host style the score line (e.g. to wrap long
    // team names); mergeStyleSets' own class is generated and can't be targeted.
    return (
        <div className={`${classes.board} modaq-scoreboard`}>
            <Stack>
                <StackItem>{label}</StackItem>
                {protestIndicator != undefined && (
                    <StackItem>
                        <ProtestIndicator />
                    </StackItem>
                )}
            </Stack>
        </div>
    );
});

const ProtestIndicator = observer(function ProtestIndicator() {
    const appState: AppState = useAppState();

    return appState.game.protestsMatter ? (
        <Stack horizontal={true}>
            <StackItem>
                <Icon iconName="Warning" styles={warningIconStyles} />
            </StackItem>
            <StackItem>
                <Label>Protests can affect the game, resolve them before exporting</Label>
            </StackItem>
        </Stack>
    ) : (
        <></>
    );
});

const warningIconStyles: IIconStyles = {
    root: {
        marginRight: 5,
        fontSize: 22,
    },
};

interface IScoreboardStyle {
    board: string;
}

const getClassNames = (): IScoreboardStyle =>
    mergeStyleSets({
        board: {
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
            padding: "5px 10px",
        },
    });
