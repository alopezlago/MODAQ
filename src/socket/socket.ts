import * as signalr from "@microsoft/signalr";
import { UIState } from "src/state/UIState";

// Eventually the intialization text should include the channel ID and a game GUID, which is only revealed to the reader
// through a DM
export function initializeSocket(initializationText: string, uiState: UIState): void {
    const connection: signalr.HubConnection = new signalr.HubConnectionBuilder().withUrl("/hub").build();

    connection.on("PlayerBuzz", (name: string) => {
        console.log("Buzz for " + name);
        uiState.setSocketBuzzedInPlayer(name);
    });

    connection.on("Clear", () => {
        console.log("Clear!");
        uiState.clearSocketBuzzedInPlayer();
    });

    connection
        .start()
        .then(() => {
            connection.invoke("AddToChannel", initializationText);
        })
        .catch((err) => {
            return console.error(err.toString());
        });
}
