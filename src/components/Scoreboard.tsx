import React from "react";
import { Icon, IIconStyles, ILabelStyles, Label, mergeStyleSets, Stack, StackItem } from "@fluentui/react";
import { observer } from "mobx-react-lite";

import { AppState } from "../state/AppState";
import { StateContext } from "../contexts/StateContext";

const labelStyles: ILabelStyles = {
    root: {
        fontSize: 18,
    },
};

const scoreCellStyle: React.CSSProperties = {
    paddingLeft: 5,
};

export const Scoreboard = observer(function Scoreboard() {
    const appState: AppState = React.useContext(StateContext);
    const classes: IScoreboardStyle = getClassNames();

    const scores: number[] = appState.game.finalScore;
    const teamNames = appState.game.teamNames;
    let label: JSX.Element | undefined;
    if (appState.uiState.isScoreVertical) {
        label = (
            <table>
                <tbody>
                    {teamNames.map((teamName, index) => (
                        <tr key={teamName}>
                            <td>
                                <Label styles={labelStyles}>{teamName}</Label>
                            </td>
                            <td style={scoreCellStyle}>
                                <Label styles={labelStyles}>{scores[index]}</Label>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    } else {
        label = (
            <Label styles={labelStyles}>
                {teamNames.map((teamName, index) => `${teamName}: ${scores[index]}`).join(", ")}
            </Label>
        );
    }

    const protestIndicator = <ProtestIndicator />;
    return (
        <div className={classes.board}>
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
    const appState: AppState = React.useContext(StateContext);

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
