import React from "react";
import { mergeStyleSets } from "@fluentui/react";

import { observer } from "mobx-react";
import { AppState } from "src/state/AppState";

export const Scoreboard = observer((props: IScoreboardProps) => {
    const classes: IScoreboardStyle = getClassNames();

    const scores: [number, number] = props.appState.game.finalScore;
    const teamNames = props.appState.game.teamNames;
    const result = teamNames.length >= 2 ? `${teamNames[0]}: ${scores[0]}, ${teamNames[1]}: ${scores[1]}` : "";
    return <div className={classes.board}>{result}</div>;
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
            border: "1px solid darkgray",
            padding: "5px 10px",
            fontSize: 16,
        },
    });
