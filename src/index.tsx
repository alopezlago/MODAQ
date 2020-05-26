// Recommendation is to have separate stores for the UI and for different domains. See https://mobx.js.org/best/store.html

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observable } from 'mobx';
import { observer } from 'mobx-react';

import { Tossup, Bonus, PacketState } from './state/PacketState';
import { GameState } from './state/GameState';
import { Player } from './state/TeamState';
import { CycleChooser } from './components/CycleChooser';
import { UIState } from './state/UIState';
import { QuestionViewerContainer } from './components/QuestionViewerContainer';

class AppState {
    @observable gameState: GameState;

    @observable uiState: UIState;

    constructor() {
        this.gameState = new GameState();
        this.uiState = new UIState();
    }
}

@observer
class TimerView extends React.Component<{ appState: AppState }> {
    public render() {
        return (
            <div>
                <div>
                    Questions: {this.props.appState.gameState.packet.tossups.map(x => x.question)}
                </div>
                <button onClick={this.onInitialize}>
                    Initialize game state
                </button>
                <div>
                    GameState: {JSON.stringify(this.props.appState.gameState)}
                </div>
                <QuestionViewerContainer game={this.props.appState.gameState} uiState={this.props.appState.uiState}></QuestionViewerContainer>
            </div>
        );
    }

    private onInitialize = () => {
        const firstTeam = this.props.appState.gameState.firstTeam;
        firstTeam.name = "Alpha";
        firstTeam.players = [
            new Player("Alan"),
            new Player("Alice"),
            new Player("Antonio")
        ];

        const secondTeam = this.props.appState.gameState.secondTeam;
        secondTeam.name = "B 2";
        secondTeam.players = [
            new Player("Betty"),
            new Player("Bradley")
        ];

        const packet = new PacketState();
        packet.tossups = [
            new Tossup("This American was the first presient of the USA.", "George Washington"),
            new Tossup("This is the first perfect number. For 10 points, name how many sides a hexagon has.", "6")
        ]

        packet.bonsues = [
            new Bonus("This is a leadin", [{
                question: "This is the first part",
                answer: "First answer"
            },
            {
                question: "This is the second part",
                answer: "Second answer"
            },
            {
                question: "This is the third part",
                answer: "Third answer"
            }]),
            new Bonus("He wrote An Irishman Airman forsees his death", [{
                question: "Name this poet",
                answer: "William Butler Yeats"
            },
            {
                question: "Yeats also wrote this poem that contains the phrase \"the center cannot hold\".",
                answer: "The Second Coming"
            },
            {
                question: "Yeats also wrote a poem about Leda and this animal that Zeus turned into.",
                answer: "swan"
            }])
        ];

        this.props.appState.gameState.loadPacket(packet);
    }
}

class ErrorBoundary extends React.Component<Record<string, unknown>, IErrorBoundaryState> {
    constructor(props: Record<string, unknown>) {
        super(props);

        this.state = { error: undefined };
    }

    static getDerivedStateFromError(error: Error | string): IErrorBoundaryState {
        // Update state so the next render will show the fallback UI.
        return { error };
    }

    // // componentDidCatch(error, errorInfo) {
    // //     // You can also log the error to an error reporting service
    // //     // logErrorToMyService(error, errorInfo);
    // // }

    public render() {
        if (this.state.error) {
            const text: string = "Something went wrong. Error: " + this.state.error;
            return <div>{text}</div>;
        }

        return this.props.children;
    }
}

interface IErrorBoundaryState {
    error: Error | string | undefined;
}

const appState = new AppState();
ReactDOM.render(<ErrorBoundary><TimerView appState={appState} /></ErrorBoundary>, document.getElementById('root'));
