import React from "react";
import { Icon, IIconStyles, Label, mergeStyleSets, Stack, StackItem } from "@fluentui/react";
import { observer } from "mobx-react-lite";

import { AppState } from "src/state/AppState";
import { StateContext } from "src/contexts/StateContext";

export const Scoreboard = observer(() => {
    const appState: AppState = React.useContext(StateContext);
    const classes: IScoreboardStyle = getClassNames();

    const scores: [number, number] = appState.game.finalScore;
    const teamNames = appState.game.teamNames;
    const result = teamNames.length >= 2 ? `${teamNames[0]}: ${scores[0]}, ${teamNames[1]}: ${scores[1]}` : "";

    const protestIndicator = <ProtestIndicator />;
    return (
        <div className={classes.board}>
            <Stack>
                <StackItem>
                    <Label>{result}</Label>
                </StackItem>
                {protestIndicator != undefined && (
                    <StackItem>
                        <ProtestIndicator />
                    </StackItem>
                )}
            </Stack>
        </div>
    );
});

const ProtestIndicator = observer(() => {
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
            fontSize: 16,
        },
    });
