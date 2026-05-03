import { observer } from "mobx-react-lite";
import React, { ReactElement } from "react";
import { AppState } from "../state/AppState";

export const StateContext = React.createContext<AppState | undefined>(undefined);

export function useAppState(): AppState {
    const appState = React.useContext(StateContext);
    if (appState == undefined) {
        throw new Error("StateContext used outside StateProvider");
    }

    return appState;
}

export const StateProvider = observer(function StateProvider(
    props: React.PropsWithChildren<IStateProviderProps>
): ReactElement {
    return <StateContext.Provider value={props.appState}>{props.children}</StateContext.Provider>;
});

export interface IStateProviderProps {
    appState: AppState;
}
