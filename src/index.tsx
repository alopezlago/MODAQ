// Recommendation is to have separate stores for the UI and for different domains. See https://mobx.js.org/best/store.html

import * as React from "react";
import * as ReactDOM from "react-dom";
import { initializeIcons } from "office-ui-fabric-react/lib/Icons";
import { configure, observable } from "mobx";
import { observer } from "mobx-react";
import { AsyncTrunk } from "mobx-sync";
import "mobx-react/batchingForReactDom";

import { Tossup, Bonus, PacketState, IBonusPart as BonusPart } from "./state/PacketState";
import { GameState } from "./state/GameState";
import { UIState } from "./state/UIState";
import { Cycle } from "./state/Cycle";
import { GameViewer } from "./components/GameViewer";
import { PacketLoader } from "./components/PacketLoader";

class AppState {
    @observable gameState: GameState;

    @observable uiState: UIState;

    constructor() {
        configure({ enforceActions: "observed", computedRequiresReaction: true });

        this.gameState = new GameState();
        this.uiState = new UIState();
    }
}

@observer
class Root extends React.Component<{ appState: AppState }> {
    public render() {
        return (
            <div>
                <button onClick={this.onInitialize}>Initialize game state</button>
                <PacketLoader
                    onLoad={this.onPacketLoaded}
                    game={this.props.appState.gameState}
                    uiState={this.props.appState.uiState}
                />
                <GameViewer game={this.props.appState.gameState} uiState={this.props.appState.uiState} />
            </div>
        );
    }

    private onPacketLoaded = (): void => {
        const firstTeam = this.props.appState.gameState.firstTeam;
        firstTeam.setName("Alpha");
        this.props.appState.gameState.addPlayers(firstTeam, "Alan", "Alice", "Antonio");

        const secondTeam = this.props.appState.gameState.secondTeam;
        secondTeam.setName("B 2");
        this.props.appState.gameState.addPlayers(secondTeam, "Betty", "Bradley");

        // TODO: Add parsing logic to turn QEMS/Jerry's parser output to Tossups and BonusQuestions for the packet
        // TODO: Translate <em></em> and <req></req> into italicized and bolded+underlined styles
    };

    private onInitialize = (): void => {
        const firstTeam = this.props.appState.gameState.firstTeam;
        firstTeam.setName("Alpha");
        this.props.appState.gameState.addPlayers(firstTeam, "Alan", "Alice", "Antonio");

        const secondTeam = this.props.appState.gameState.secondTeam;
        secondTeam.setName("B 2");
        this.props.appState.gameState.addPlayers(secondTeam, "Betty", "Bradley");

        const packet = new PacketState();
        packet.setTossups([
            new Tossup("This American was the first president of the USA.", "George Washington"),
            new Tossup("This is the first perfect number. For 10 points, name how many sides a hexagon has.", "6"),
        ]);

        packet.setBonuses([
            new Bonus("This is a leadin", [
                new BonusPart("This is the first part", "First answer"),
                new BonusPart("This is the second part", "Second answer"),
                new BonusPart("This is the third part", "Third answer"),
            ]),
            new Bonus("He wrote An Irishman Airman forsees his death", [
                new BonusPart("Name this poet", "William Butler Yeats"),
                new BonusPart(
                    'Yeats also wrote this poem that contains the phrase "the center cannot hold".',
                    "The Second Coming"
                ),
                new BonusPart("Yeats also wrote a poem about Leda and this animal that Zeus turned into.", "swan"),
            ]),
        ]);

        this.props.appState.gameState.loadPacket(packet);

        const firstCycle: Cycle = this.props.appState.gameState.cycles[0];
        firstCycle.addNeg(
            {
                correct: false,
                player: this.props.appState.gameState.getPlayers(secondTeam)[0],
                position: 2,
            },
            0
        );
        firstCycle.addCorrectBuzz(
            {
                correct: true,
                player: this.props.appState.gameState.getPlayers(firstTeam)[1],
                position: 4,
            },
            0,
            0
        );
    };
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

initializeIcons();

// This element might not exist when running tests. In that case, skip rendering the application.
const element: HTMLElement | null = document.getElementById("root");
if (element) {
    const appState = new AppState();
    const trunk = new AsyncTrunk(appState, { storage: localStorage, delay: 100 });

    trunk.init(appState).then(() => {
        ReactDOM.render(
            <ErrorBoundary>
                <Root appState={appState} />
            </ErrorBoundary>,
            document.getElementById("root")
        );
    });
}
