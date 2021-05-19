import React from "react";
import { Label, mergeStyleSets } from "@fluentui/react";
import { observer } from "mobx-react-lite";

import { AppState } from "src/state/AppState";
import { StateContext } from "src/contexts/StateContext";

export const Scoreboard = observer(() => {
    const appState: AppState = React.useContext(StateContext);
    const classes: IScoreboardStyle = getClassNames();

    const scores: [number, number] = appState.game.finalScore;
    const teamNames = appState.game.teamNames;
    const result = teamNames.length >= 2 ? `${teamNames[0]}: ${scores[0]}, ${teamNames[1]}: ${scores[1]}` : "";
    return <Label className={classes.board}>{result}</Label>;
});

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
