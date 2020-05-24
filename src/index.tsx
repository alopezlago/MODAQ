// This file was copied from https://github.com/mobxjs/mobx-react-typescript-boilerplate for setup. It will be replaced.

// Recommendation is to have separate stores for the UI and for different domains. See https://mobx.js.org/best/store.html

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observable } from 'mobx';
import { observer } from 'mobx-react';
import { PacketState, Tossup } from './state/PacketState';

class AppState {
    @observable timer = 0;

    @observable packetState: PacketState;

    constructor() {
        setInterval(() => {
            this.timer += 1;
        }, 1000);

        this.packetState = observable(new PacketState());
    }

    resetTimer() {
        const tossup: Tossup = new Tossup();
        tossup.question = this.timer.toString();
        tossup.answer = "Answer";

        this.packetState.tossups.push(tossup);

        this.timer = 0;
    }
}

@observer
class TimerView extends React.Component<{ appState: AppState }> {
    render() {
        return (
            <div>
                <button onClick={this.onReset}>
                    Seconds passed: {this.props.appState.timer}
                </button>
                <div>
                    Questions: {this.props.appState.packetState.tossups.map(x => x.question)}
                </div>
            </div>
        );
    }

    onReset = () => {
        this.props.appState.resetTimer();
    }
}

const appState = new AppState();
ReactDOM.render(<TimerView appState={appState} />, document.getElementById('root'));
