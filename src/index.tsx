// Recommendation is to have separate stores for the UI and for different domains. See https://mobx.js.org/best/store.html

import * as React from "react";
import * as ReactDOM from "react-dom";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { configure } from "mobx";
import { observer } from "mobx-react-lite";
import { AsyncTrunk } from "mobx-sync";

import { GameViewer } from "./components/GameViewer";
import { AppState } from "./state/AppState";
import { ModalDialogContainer } from "./components/ModalDialogContainer";

const Root = observer((props: IRootProps) => {
    const onClear = (): void => {
        const trunk = new AsyncTrunk(props.appState, { storage: localStorage, delay: 100 });
        trunk.clear();
        location.reload();
    };

    return (
        <div>
            <button onClick={onClear}>Clear state</button>
            <GameViewer appState={props.appState} />
            <ModalDialogContainer appState={props.appState} />
        </div>
    );
});

interface IRootProps {
    appState: AppState;
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

    // TODO: This should have a clear button reset the state
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
    configure({ enforceActions: "observed", computedRequiresReaction: true });
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
