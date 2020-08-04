import React from "react";

import { observer } from "mobx-react";
import { GameState } from "src/state/GameState";
import { UIState } from "src/state/UIState";
import { createUseStyles } from "react-jss";

export const Scoreboard = observer((props: IScoreboardProps) => {
    const classes: IScoreboardStyle = useStyles();

    const scores: [number, number] = props.game.finalScore;
    const teamNames = props.game.teamNames;
    const result = teamNames.length >= 2 ? `${teamNames[0]}: ${scores[0]}, ${teamNames[1]}: ${scores[1]}` : "";
    return <div className={classes.board}>{result}</div>;
});

export interface IScoreboardProps {
    game: GameState;
    uiState: UIState;
}

interface IScoreboardStyle {
    board: string;
}

const useStyles: (data?: unknown) => IScoreboardStyle = createUseStyles({
    board: {
        border: "1px solid darkgray",
        padding: "5px 10px",
        fontSize: 16,
    },
});
