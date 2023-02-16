import * as React from "react";
import { Text } from "@fluentui/react";
import { observer } from "mobx-react-lite";

import { AppState } from "../state/AppState";
import { StateContext } from "../contexts/StateContext";

export const ExportStatus = observer(function ExportStatus() {
    const appState: AppState = React.useContext(StateContext);

    if (
        appState.uiState.isCustomExportStatusHidden ||
        appState.uiState.customExportOptions == undefined ||
        appState.uiState.customExportStatus == undefined
    ) {
        return <></>;
    }

    return <Text>{appState.uiState.customExportStatus}</Text>;
});
