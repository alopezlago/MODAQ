import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    TextField,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    Dropdown,
    Stack,
    StackItem,
    IDropdownOption,
} from "@fluentui/react";

import * as RenameTeamDialogController from "./RenameTeamDialogController";
import { AppState } from "../../state/AppState";
import { useAppState } from "../../contexts/StateContext";
import { RenameTeamDialogState } from "../../state/RenameTeamDialogState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

export const RenameTeamDialog = observer(function RenameTeamDialog(): JSX.Element {
    const appState: AppState = useAppState();

    return (
        <ModalDialog
            title="Rename Team"
            visibilityStatus={ModalVisibilityStatus.RenameTeam}
            onDismiss={() => RenameTeamDialogController.hideDialog(appState)}
        >
            <RenameTeamDialogBody appState={appState} />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={() => RenameTeamDialogController.renameTeam(appState)} />
                <DefaultButton text="Cancel" onClick={() => RenameTeamDialogController.hideDialog(appState)} />
            </DialogFooter>
        </ModalDialog>
    );
});

const RenameTeamDialogBody = observer(function RenameTeamDialogBody(props: IRenameTeamDialogBodyProps): JSX.Element {
    const appState: AppState = props.appState;

    const teamChangeHandler = (ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
        if (option?.text != undefined) {
            RenameTeamDialogController.changeTeam(appState, option.text);
        }
    };

    const renameTeamDialog: RenameTeamDialogState | undefined = appState.uiState.dialogState.renameTeamDialog;
    if (renameTeamDialog === undefined) {
        return <></>;
    }

    const teamOptions: IDropdownOption[] = appState.game.teamNames.map((teamName, index) => {
        return {
            key: index,
            text: teamName,
            selected: renameTeamDialog.teamName === teamName,
        };
    });

    return (
        <Stack>
            <StackItem>
                <Dropdown label="Team" options={teamOptions} onChange={teamChangeHandler} />
            </StackItem>
            <StackItem>
                <TextField
                    autoFocus={true}
                    label="Name"
                    value={renameTeamDialog.newName}
                    required={true}
                    onChange={(ev, newValue) => onNameChange(appState, ev, newValue)}
                    onGetErrorMessage={() => RenameTeamDialogController.validate(appState)}
                    validateOnFocusOut={true}
                    validateOnLoad={false}
                />
            </StackItem>
        </Stack>
    );
});

function onNameChange(
    appState: AppState,
    ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
) {
    RenameTeamDialogController.changeNewName(appState, newValue ?? "");
}

interface IRenameTeamDialogBodyProps {
    appState: AppState;
}
