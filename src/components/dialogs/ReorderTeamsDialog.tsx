import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    DefaultButton,
    DialogFooter,
    IconButton,
    IIconProps,
    IStackTokens,
    Label,
    PrimaryButton,
    Stack,
    StackItem,
} from "@fluentui/react";

import * as ReorderTeamsDialogController from "./ReorderTeamsDialogController";
import { AppState } from "../../state/AppState";
import { useAppState } from "../../contexts/StateContext";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

const dialogBodyTokens: IStackTokens = { childrenGap: 10 };
const rowTokens: IStackTokens = { childrenGap: 4 };
const upButtonProps: IIconProps = { iconName: "ChevronUp" };
const downButtonProps: IIconProps = { iconName: "ChevronDown" };

// Reordering more than two teams: the list of teams, each with up and down.
// (Two teams are swapped from a confirmation instead; see GameBar.)
export const ReorderTeamsDialog = observer(function ReorderTeamsDialog(): JSX.Element {
    const appState: AppState = useAppState();

    return (
        <ModalDialog
            title="Reorder teams"
            visibilityStatus={ModalVisibilityStatus.ReorderTeams}
            onDismiss={() => ReorderTeamsDialogController.hideDialog(appState)}
        >
            <ReorderTeamsDialogBody appState={appState} />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={() => ReorderTeamsDialogController.submitOrder(appState)} />
                <DefaultButton text="Cancel" onClick={() => ReorderTeamsDialogController.hideDialog(appState)} />
            </DialogFooter>
        </ModalDialog>
    );
});

const ReorderTeamsDialogBody = observer(function ReorderTeamsDialogBody(props: { appState: AppState }): JSX.Element {
    const appState: AppState = props.appState;
    const dialog = appState.uiState.dialogState.reorderTeamsDialog;
    if (dialog == undefined) {
        return <></>;
    }

    const count: number = dialog.teamNames.length;
    return (
        <Stack tokens={dialogBodyTokens}>
            <StackItem>
                <Label>Use the up and down buttons to put the teams in order.</Label>
            </StackItem>
            {dialog.teamNames.map((teamName, index) => (
                <Stack key={teamName} horizontal={true} verticalAlign="center" tokens={rowTokens}>
                    <StackItem grow={1}>
                        <span>
                            {index + 1}. {teamName}
                        </span>
                    </StackItem>
                    <StackItem>
                        <IconButton
                            iconProps={upButtonProps}
                            title="Move up"
                            ariaLabel={`Move ${teamName} up`}
                            disabled={index === 0}
                            onClick={() => ReorderTeamsDialogController.moveTeam(appState, index, -1)}
                        />
                    </StackItem>
                    <StackItem>
                        <IconButton
                            iconProps={downButtonProps}
                            title="Move down"
                            ariaLabel={`Move ${teamName} down`}
                            disabled={index >= count - 1}
                            onClick={() => ReorderTeamsDialogController.moveTeam(appState, index, 1)}
                        />
                    </StackItem>
                </Stack>
            ))}
        </Stack>
    );
});
