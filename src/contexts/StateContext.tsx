import { observer } from "mobx-react-lite";
import React, { ReactElement } from "react";
import { AppState } from "../state/AppState";

export const StateContext = React.createContext<AppState>(new AppState());

export const StateProvider = observer(function StateProvider(
    props: React.PropsWithChildren<IStateProviderProps>
): ReactElement {
    return <StateContext.Provider value={props.appState}>{props.children}</StateContext.Provider>;
});

export interface IStateProviderProps {
    appState: AppState;
}
