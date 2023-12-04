import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    Dropdown,
    IDropdownOption,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    Stack,
    Label,
    StackItem,
    IStackTokens,
} from "@fluentui/react";

import * as ReorderPlayersDialogController from "../../components/dialogs/ReorderPlayersDialogController";
import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";
import { ReorderPlayersDialogState } from "../../state/ReorderPlayersDialogState";
import { PlayerRoster } from "../PlayerRoster";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

const dialogBodyTokens: IStackTokens = { childrenGap: 10 };

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const ReorderPlayerDialog = observer(function ReorderPlayerDialog(): JSX.Element {
    return (
        <ModalDialog
            title="Reorder Players"
            visibilityStatus={ModalVisibilityStatus.ReorderPlayers}
            onDismiss={ReorderPlayersDialogController.hideDialog}
        >
            <ReorderPlayerDialogBody />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={ReorderPlayersDialogController.submit} />
                <DefaultButton text="Cancel" onClick={ReorderPlayersDialogController.hideDialog} />
            </DialogFooter>
        </ModalDialog>
    );
});

const ReorderPlayerDialogBody = observer(function ReorderPlayerDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const teamChangeHandler = React.useCallback((ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option?.text != undefined) {
            ReorderPlayersDialogController.changeTeamName(option.text);
        }
    }, []);

    const reorderPlayersDialog: ReorderPlayersDialogState | undefined =
        appState.uiState.dialogState.reorderPlayersDialog;
    if (reorderPlayersDialog === undefined) {
        return <></>;
    }

    const teamOptions: IDropdownOption[] = appState.game.teamNames.map((teamName, index) => {
        return {
            key: index,
            text: teamName,
            selected: reorderPlayersDialog.teamName === teamName,
        };
    });

    const players: Player[] = reorderPlayersDialog.players.filter((p) => p.teamName === reorderPlayersDialog.teamName);

    return (
        <Stack tokens={dialogBodyTokens}>
            <StackItem>
                <Label>
                    Drag and drop players into the desired position, or use the up and down buttons next to the player
                    to move them up or down the list.
                </Label>
            </StackItem>
            <StackItem>
                <Dropdown label="Team" options={teamOptions} onChange={teamChangeHandler} />
            </StackItem>
            <StackItem>
                <PlayerRoster
                    canSetStarter={false}
                    players={players}
                    onMovePlayerBackward={ReorderPlayersDialogController.moveBackward}
                    onMovePlayerForward={ReorderPlayersDialogController.moveForward}
                    onMovePlayerToIndex={ReorderPlayersDialogController.movePlayerToIndex}
                />
            </StackItem>
        </Stack>
    );
});
