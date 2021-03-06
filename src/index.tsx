// Recommendation is to have separate stores for the UI and for different domains. See https://mobx.js.org/best/store.html

import * as React from "react";
import * as ReactDOM from "react-dom";
import {
    DefaultButton,
    Dialog,
    DialogFooter,
    DialogType,
    IButtonStyles,
    IDialogContentProps,
    Label,
    PrimaryButton,
    Stack,
    StackItem,
} from "@fluentui/react";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { configure } from "mobx";
import { observer } from "mobx-react-lite";
import { AsyncTrunk } from "mobx-sync";

import { GameViewer } from "./components/GameViewer";
import { AppState } from "./state/AppState";
import { ModalDialogContainer } from "./components/ModalDialogContainer";

const Root = observer((props: IRootProps) => {
    return (
        <div>
            <GameViewer appState={props.appState} />
            <ModalDialogContainer appState={props.appState} />
        </div>
    );
});

interface IRootProps {
    appState: AppState;
}

// TODO: Move to a separate file in Component?
class ErrorBoundary extends React.Component<IErrorBoundaryProps, IErrorBoundaryState> {
    private static readonly dialogContent: IDialogContentProps = {
        type: DialogType.normal,
        title: "Reset",
        closeButtonAriaLabel: "Close",
        subText: "Do you wish to reset the reader? You will lose your current game.",
    };

    private static readonly exportButtonStyle: IButtonStyles = {
        root: {
            marginRight: 20,
            marginTop: 20,
        },
    };

    constructor(props: IErrorBoundaryProps) {
        super(props);

        this.state = { error: undefined, showClearPrompt: false };
    }

    static getDerivedStateFromError(error: Error | string): IErrorBoundaryState {
        // Update state so the next render will show the fallback UI.
        return { error, showClearPrompt: false };
    }

    // // componentDidCatch(error, errorInfo) {
    // //     // You can also log the error to an error reporting service. We don't have a logging service for this
    // // }

    public render() {
        if (this.state.error) {
            const text: string = "Error: " + this.state.error;

            // This shouldn't re-render often, and the user should leave the page soon when this appears, so skip
            // memoization
            const onClear = (): void => {
                const trunk = new AsyncTrunk(this.props.appState, { storage: localStorage, delay: 100 });
                trunk.clear();
                location.reload();
            };

            const hideDialog = (): void => {
                this.setState({ showClearPrompt: false });
            };

            const showDialog = (): void => {
                this.setState({ showClearPrompt: true });
            };

            const gameJson: Blob = new Blob([JSON.stringify(this.props.appState.game)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(gameJson);

            return (
                <Stack>
                    <StackItem>
                        <h2>Something went wrong</h2>
                    </StackItem>
                    <StackItem>
                        <Label>{text}</Label>
                    </StackItem>
                    <StackItem>
                        <Label>
                            Refreshing the page fixes most errors. If you keep seeing errors, click on the first button
                            to copy the JSON of all the events, then click on the second button to reset the app.
                        </Label>
                    </StackItem>
                    <StackItem>
                        <PrimaryButton
                            aria-label="Export game (JSON)"
                            text="Export game (JSON)"
                            styles={ErrorBoundary.exportButtonStyle}
                            href={url}
                            download="QuizBowlReader_Game_Error.json"
                        />
                        <DefaultButton onClick={showDialog} text="Reset" />
                    </StackItem>
                    <Dialog
                        hidden={!this.state.showClearPrompt}
                        onDismiss={hideDialog}
                        dialogContentProps={ErrorBoundary.dialogContent}
                    >
                        <DialogFooter>
                            <PrimaryButton onClick={onClear} text="OK" />
                            <DefaultButton onClick={hideDialog} text="Cancel" />
                        </DialogFooter>
                    </Dialog>
                </Stack>
            );
        }

        return this.props.children;
    }
}

interface IErrorBoundaryProps {
    appState: AppState;
}

interface IErrorBoundaryState {
    error: Error | string | undefined;
    showClearPrompt: boolean;
}

initializeIcons();

// This element might not exist when running tests. In that case, skip rendering the application.
const element: HTMLElement | null = document.getElementById("root");
if (element) {
    configure({ enforceActions: "observed", computedRequiresReaction: true });
    const appState = new AppState();
    const trunk = new AsyncTrunk(appState, { storage: localStorage, delay: 200 });

    trunk.init(appState).then(() => {
        ReactDOM.render(
            <ErrorBoundary appState={appState}>
                <Root appState={appState} />
            </ErrorBoundary>,
            document.getElementById("root")
        );
    });
}
