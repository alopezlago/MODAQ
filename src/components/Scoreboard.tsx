import React from "react";
import { Label, mergeStyleSets } from "@fluentui/react";
import { observer } from "mobx-react-lite";

import { AppState } from "src/state/AppState";

export const Scoreboard = observer((props: IScoreboardProps) => {
    const classes: IScoreboardStyle = getClassNames();

    const scores: [number, number] = props.appState.game.finalScore;
    const teamNames = props.appState.game.teamNames;
    const result = teamNames.length >= 2 ? `${teamNames[0]}: ${scores[0]}, ${teamNames[1]}: ${scores[1]}` : "";
    return <Label className={classes.board}>{result}</Label>;
});

export interface IScoreboardProps {
    appState: AppState;
}

interface IScoreboardStyle {
    board: string;
}

const getClassNames = (): IScoreboardStyle =>
    mergeStyleSets({
        board: {
            display: "flex",
            justifyContent: "center",
            padding: "5px 10px",
            fontSize: 16,
        },
    });
