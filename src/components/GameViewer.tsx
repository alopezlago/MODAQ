import React from "react";
import { observer } from "mobx-react-lite";
import { IStackTokens, mergeStyleSets, Stack, StackItem } from "@fluentui/react";

import { QuestionViewerContainer } from "./QuestionViewerContainer";
import { Scoreboard } from "./Scoreboard";
import { EventViewer } from "./EventViewer";
import { GameBar } from "./GameBar";
import { AppState } from "src/state/AppState";
import { StateContext } from "src/contexts/StateContext";

const scoreboardAndQuestionViewerTokens: IStackTokens = { childrenGap: 20 };

export const GameViewer = observer(() => {
    const appState: AppState = React.useContext(StateContext);
    const gameExists: boolean = appState.game.isLoaded;

    const classes: IGameViewerClassNames = getClassNames(gameExists, appState.uiState.isEventLogHidden);

    // TODO: See if we should convert the game viewer section into a StackItem. It's using a grid now, so it might
    // not make sense to have it be a stack item. Alternatively, we could make another Stack that's horizontally aligned
    return (
        <Stack>
            <StackItem>
                <GameBar />
            </StackItem>
            <div className={classes.gameViewer}>
                <StackItem className={classes.questionViewerContainer}>
                    <Stack tokens={scoreboardAndQuestionViewerTokens}>
                        <StackItem>
                            <Scoreboard />
                        </StackItem>
                        <StackItem>
                            <QuestionViewerContainer />
                        </StackItem>
                    </Stack>
                </StackItem>
                <StackItem className={classes.eventViewerContainer}>
                    <EventViewer />
                </StackItem>
            </div>
        </Stack>
    );
});

interface IGameViewerClassNames {
    gameViewer: string;
    eventViewerContainer: string;
    questionViewerContainer: string;
}

// TODO: play around with flex-grow/flex-shrink to see what will work. Alternatively, have a minimum width for scoreboard
const getClassNames = (gameLoaded: boolean, isEventLogHidden: boolean): IGameViewerClassNames =>
    mergeStyleSets({
        gameViewer: {
            // Grid should be more resize friendly than flex if we ever do responsive design
            display: "grid",
            gridTemplateColumns: isEventLogHidden ? "1fr" : "3fr 1fr",
        },
        eventViewerContainer: {
            margin: "0 10px",
            overflowY: "auto",
            visibility: gameLoaded ? undefined : "hidden",
        },
        questionViewerContainer: {},
    });
