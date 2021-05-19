import React, { ReactElement } from "react";
import { AppState } from "src/state/AppState";

export const StateContext = React.createContext<AppState>(new AppState());

export function StateProvider(props: React.PropsWithChildren<IStateProviderProps>): ReactElement {
    return <StateContext.Provider value={props.appState}>{props.children}</StateContext.Provider>;
}

export interface IStateProviderProps {
    appState: AppState;
}
