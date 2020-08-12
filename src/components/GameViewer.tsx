import React from "react";
import { observer } from "mobx-react";
import { mergeStyleSets } from "@fluentui/react";

import { GameState } from "src/state/GameState";
import { UIState } from "src/state/UIState";
import { QuestionViewerContainer } from "./QuestionViewerContainer";
import { Scoreboard } from "./Scoreboard";
import { EventViewer } from "./EventViewer";
import { GameBar } from "./GameBar";

// TODO: Figure out CSS to prevent the content from growing too much. GameViewer should probably have like 90/100% of
// the height. We need to make sure the contents also don't grow beyond the page, and add overflow handling to the
// viewer containers
export const GameViewer = observer((props: IGameViewerProps) => {
    const classes: IGameViewerClassNames = getClassNames();

    // TODO: If we begin adding more dialogs, create a DialogManager
    return (
        <div>
            <GameBar game={props.game} uiState={props.uiState} />
            <div className={classes.gameViewer}>
                <div className={classes.questionViewerContainer}>
                    <QuestionViewerContainer game={props.game} uiState={props.uiState}></QuestionViewerContainer>
                </div>
                <div className={classes.scoreboardContainer}>
                    <Scoreboard game={props.game} uiState={props.uiState} />
                    <EventViewer game={props.game} uiState={props.uiState} />
                </div>
            </div>
        </div>
    );
});

export interface IGameViewerProps {
    game: GameState;
    uiState: UIState;
}

interface IGameViewerClassNames {
    gameViewer: string;
    scoreboardContainer: string;
    questionViewerContainer: string;
}

// TODO: play around with flex-grow/flex-shrink to see what will work. Alternatively, have a minimum width for scoreboard
const getClassNames = (): IGameViewerClassNames =>
    mergeStyleSets({
        gameViewer: {
            // Grid should be more resize friendly than flex if we ever do responsive design
            display: "grid",
            gridTemplateColumns: "3fr 1fr",
            // height: "100%",
        },
        scoreboardContainer: {
            margin: "0 10px",
            overflowY: "auto",
        },
        questionViewerContainer: {},
    });
