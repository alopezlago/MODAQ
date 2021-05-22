import React from "react";
import { observer } from "mobx-react-lite";
import {
    IDialogContentProps,
    DialogType,
    IButtonStyles,
    Stack,
    StackItem,
    Label,
    PrimaryButton,
    DefaultButton,
    Dialog,
    DialogFooter,
    initializeIcons,
} from "@fluentui/react";
import { AsyncTrunk } from "mobx-sync";
import { configure } from "mobx";

import { StateProvider } from "src/contexts/StateContext";
import { AppState } from "src/state/AppState";
import { GameViewer } from "./GameViewer";
import { ModalDialogContainer } from "./ModalDialogContainer";

export default ModaqControl;

export const ModaqControl = observer((props: IModaqControlProps) => {
    const [appState]: [AppState, React.Dispatch<React.SetStateAction<AppState>>] = React.useState(new AppState());

    React.useEffect(() => initializeControl(appState, props.persistState ?? true, props.storeName), [
        appState,
        props.persistState,
        props.storeName,
    ]);

    return (
        <ErrorBoundary appState={appState}>
            <StateProvider appState={appState}>
                <div>
                    <GameViewer />
                    <ModalDialogContainer />
                </div>
            </StateProvider>
        </ErrorBoundary>
    );
});

export interface IModaqControlProps {
    // This can only be set on the first render
    persistState?: boolean;

    // This can only be set on the first render
    storeName?: string | undefined;
}

function initializeControl(appState: AppState, persistState: boolean, storeName: string | undefined): void {
    // Initialize Fluent UI icons on the first render
    initializeIcons();

    if (persistState) {
        configure({ enforceActions: "observed", computedRequiresReaction: true });
        const trunk = new AsyncTrunk(appState, { storage: localStorage, storageKey: storeName, delay: 200 });
        trunk.init(appState);
    }
}

interface IErrorBoundaryProps {
    appState: AppState;
}

interface IErrorBoundaryState {
    error: Error | string | undefined;
    showClearPrompt: boolean;
}

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
