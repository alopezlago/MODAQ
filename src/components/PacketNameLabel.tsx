import * as React from "react";
import { Text } from "@fluentui/react";
import { observer } from "mobx-react-lite";

import { AppState } from "../state/AppState";
import { useAppState } from "../contexts/StateContext";

export const PacketNameLabel = observer(function PacketNameLabel() {
    const appState: AppState = useAppState();

    if (!(appState.game.packet.name || appState.uiState.packetFilename)) {
        return <></>;
    }

    return <Text>Packet: {appState.game.packet.name ?? appState.uiState.packetFilename}</Text>;
});
