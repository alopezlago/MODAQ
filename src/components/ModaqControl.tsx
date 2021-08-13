import React from "react";
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

import * as PacketLoaderController from "src/components/PacketLoaderController";
import { StateProvider } from "src/contexts/StateContext";
import { AppState } from "src/state/AppState";
import { GameViewer } from "./GameViewer";
import { ModalDialogContainer } from "./ModalDialogContainer";
import { IGameFormat } from "src/state/IGameFormat";
import { IPacket } from "src/state/IPacket";
import { IPlayer, Player } from "src/state/TeamState";
import { PacketState } from "src/state/PacketState";

export const ModaqControl = (props: IModaqControlProps): JSX.Element => {
    const [appState]: [AppState, React.Dispatch<React.SetStateAction<AppState>>] = React.useState(new AppState());

    // We only want to run this effect once, which requires passing in an empty array of dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => initializeControl(appState, { ...props, persistState: props.persistState ?? true }), []);

    React.useEffect(() => update(appState, props), [appState, props]);
    React.useEffect(() => {
        if (props.gameFormat != undefined) {
            appState.game.setGameFormat(props.gameFormat);
        }
    }, [appState, props.gameFormat]);
    React.useEffect(() => {
        if (props.packet != undefined) {
            const packet: PacketState | undefined = PacketLoaderController.loadPacket(appState, props.packet);
            if (packet) {
                appState.game.loadPacket(packet);
            }
        }
    }, [appState, props.packet]);
    React.useEffect(() => {
        if (props.players != undefined) {
            appState.game.setPlayers(
                props.players
                    .filter((player) => player != undefined)
                    .map((player) => new Player(player.name, player.teamName, player.isStarter))
            );
        }
    }, [appState, props.players]);

    return (
        <ErrorBoundary appState={appState}>
            <StateProvider appState={appState}>
                <div className="modaq-control">
                    <GameViewer />
                    <ModalDialogContainer />
                </div>
            </StateProvider>
        </ErrorBoundary>
    );
};

// We can't use observables here since the user could pass in different instances of IModaqControlProps
// TODO: Should take a callback and settings for export (which ones are enabled, any new export options with a callback
// of game state/QBJ file?)
export interface IModaqControlProps {
    buildVersion?: string;
    googleClientId?: string;
    yappServiceUrl?: string;

    gameFormat?: IGameFormat;

    // This should only be set once
    packet?: IPacket;

    // This should only be set once
    players?: IPlayer[];

    // This can only be set on the first render
    persistState?: boolean;

    // This can only be set on the first render
    storeName?: string | undefined;
}

function initializeControl(appState: AppState, props: IModaqControlProps): () => void {
    // Initialize Fluent UI icons on the first render
    initializeIcons();

    if (props.persistState) {
        configure({ enforceActions: "observed", computedRequiresReaction: true });
        const trunk = new AsyncTrunk(appState, { storage: localStorage, storageKey: props.storeName, delay: 200 });
        trunk.init(appState);
    }

    // We have to add the listener at the document layer, otherwise the event isn't picked up if the user clicks on
    // the empty space
    const keydownListener: (event: KeyboardEvent) => void = (event: KeyboardEvent) => shortcutHandler(event, appState);
    document.addEventListener("keyup", keydownListener);

    return () => {
        document.removeEventListener("keyup", keydownListener);
    };
}

function shortcutHandler(event: KeyboardEvent, appState: AppState): void {
    if (event.shiftKey) {
        switch (event.key) {
            case "N":
                if (appState.uiState.cycleIndex + 1 < appState.game.playableCycles.length) {
                    appState.uiState.nextCycle();
                }
                event.preventDefault();
                event.stopPropagation();

                break;
            case "P":
                appState.uiState.previousCycle();
                event.preventDefault();
                event.stopPropagation();
                break;
            default:
                break;
        }
    }
}

function update(appState: AppState, props: IModaqControlProps): void {
    if (props.buildVersion !== appState.uiState.buildVersion) {
        appState.uiState.setBuildVersion(props.buildVersion);
    }

    if (props.googleClientId !== appState.uiState.sheetsState.clientId) {
        appState.uiState.sheetsState.setClientId(props.googleClientId);
    }

    if (props.yappServiceUrl !== appState.uiState.yappServiceUrl) {
        appState.uiState.setYappServiceUrl(props.yappServiceUrl);
    }

    if (props.gameFormat != undefined && props.gameFormat !== appState.game.gameFormat) {
        appState.game.setGameFormat(props.gameFormat);
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

export default ModaqControl;
