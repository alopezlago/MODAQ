// Recommendation is to have separate stores for the UI and for different domains. See https://mobx.js.org/best/store.html

import * as React from "react";
import * as ReactDOM from "react-dom";
import { initializeIcons } from "@fluentui/react/lib/Icons";
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
import { NewGameDialog } from "./components/NewGameDialog";

const firstTeamName = "Alpha";
const secondTeamName = "B 2";

class AppState {
    @observable game: GameState;

    @observable uiState: UIState;

    constructor() {
        configure({ enforceActions: "observed", computedRequiresReaction: true });

        this.game = new GameState();
        this.uiState = new UIState();
    }
}

@observer
class Root extends React.Component<{ appState: AppState }> {
    public render() {
        return (
            <div>
                <button onClick={this.onInitialize}>Initialize game state</button>
                <button onClick={this.onClear}>Clear state</button>
                <PacketLoader onLoad={this.onPacketLoaded} uiState={this.props.appState.uiState} />
                <NewGameDialog game={this.props.appState.game} uiState={this.props.appState.uiState} />
                <GameViewer game={this.props.appState.game} uiState={this.props.appState.uiState} />
            </div>
        );
    }

    private onClear = (): void => {
        const trunk = new AsyncTrunk(this.props.appState, { storage: localStorage, delay: 100 });
        trunk.clear();
        location.reload();
    };

    private onPacketLoaded = (packet: PacketState): void => {
        this.props.appState.game.addPlayersForDemo(firstTeamName, "Alan", "Alice", "Antonio");
        this.props.appState.game.addPlayersForDemo(secondTeamName, "Betty", "Bradley");

        this.props.appState.game.loadPacket(packet);
    };

    private onInitialize = (): void => {
        this.props.appState.game.addPlayersForDemo(firstTeamName, "Alan", "Alice", "Antonio");
        this.props.appState.game.addPlayersForDemo(secondTeamName, "Betty", "Bradley");

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

        this.props.appState.game.loadPacket(packet);

        const firstCycle: Cycle = this.props.appState.game.cycles[0];
        firstCycle.addNeg(
            {
                correct: false,
                player: this.props.appState.game.getPlayers(secondTeamName)[0],
                position: 2,
            },
            0
        );
        firstCycle.addCorrectBuzz(
            {
                correct: true,
                player: this.props.appState.game.getPlayers(firstTeamName)[1],
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
