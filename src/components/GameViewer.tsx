import React from "react";
import { observer } from "mobx-react-lite";
import { IStackTokens, mergeStyleSets, Stack, StackItem } from "@fluentui/react";

import { QuestionViewerContainer } from "./QuestionViewerContainer";
import { Scoreboard } from "./Scoreboard";
import { EventViewer } from "./EventViewer";
import { GameBar } from "./GameBar";
import { AppState } from "src/state/AppState";

const scoreboardAndQuestionViewerTokens: IStackTokens = { childrenGap: 20 };

// TODO: Figure out CSS to prevent the content from growing too much. GameViewer should probably have like 90/100% of
// the height. We need to make sure the contents also don't grow beyond the page, and add overflow handling to the
// viewer containers
export const GameViewer = observer((props: IGameViewerProps) => {
    const gameExists: boolean = props.appState.game.isLoaded;
    const classes: IGameViewerClassNames = getClassNames(gameExists);

    // TODO: See if we should convert the game viewer section into a StackItem. It's using a grid now, so it might
    // not make sense to have it be a stack item. Alternatively, we could make another Stack that's horizontally aligned
    return (
        <Stack>
            <StackItem>
                <GameBar appState={props.appState} />
            </StackItem>
            <div className={classes.gameViewer}>
                <StackItem className={classes.questionViewerContainer}>
                    <Stack tokens={scoreboardAndQuestionViewerTokens}>
                        <StackItem>
                            <Scoreboard appState={props.appState} />
                        </StackItem>
                        <StackItem>
                            <QuestionViewerContainer appState={props.appState}></QuestionViewerContainer>
                        </StackItem>
                    </Stack>
                </StackItem>
                <StackItem className={classes.eventViewerContainer}>
                    <EventViewer appState={props.appState} />
                </StackItem>
            </div>
        </Stack>
    );
});

export interface IGameViewerProps {
    appState: AppState;
}

interface IGameViewerClassNames {
    gameViewer: string;
    eventViewerContainer: string;
    questionViewerContainer: string;
}

// TODO: play around with flex-grow/flex-shrink to see what will work. Alternatively, have a minimum width for scoreboard
const getClassNames = (gameLoaded: boolean): IGameViewerClassNames =>
    mergeStyleSets({
        gameViewer: {
            // Grid should be more resize friendly than flex if we ever do responsive design
            display: "grid",
            gridTemplateColumns: "3fr 1fr",
            // height: "100%",
        },
        eventViewerContainer: {
            margin: "0 10px",
            overflowY: "auto",
            visibility: gameLoaded ? undefined : "hidden",
        },
        questionViewerContainer: {},
    });
