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
import { StateContext } from "../../contexts/StateContext";
import { RenameTeamDialogState } from "../../state/RenameTeamDialogState";
import { ModalVisibilityStatus } from "../../state/ModalVisibilityStatus";
import { ModalDialog } from "./ModalDialog";

export const RenameTeamDialog = observer(function RenameTeamDialog(): JSX.Element {
    return (
        <ModalDialog
            title="Rename Team"
            visibilityStatus={ModalVisibilityStatus.RenameTeam}
            onDismiss={RenameTeamDialogController.hideDialog}
        >
            <RenameTeamDialogBody />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={RenameTeamDialogController.renameTeam} />
                <DefaultButton text="Cancel" onClick={RenameTeamDialogController.hideDialog} />
            </DialogFooter>
        </ModalDialog>
    );
});

const RenameTeamDialogBody = observer(function RenameTeamDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const teamChangeHandler = React.useCallback((ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option?.text != undefined) {
            RenameTeamDialogController.changeTeam(option.text);
        }
    }, []);

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
                    onChange={onNameChange}
                    onGetErrorMessage={RenameTeamDialogController.validate}
                    validateOnFocusOut={true}
                    validateOnLoad={false}
                />
            </StackItem>
        </Stack>
    );
});

function onNameChange(ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) {
    RenameTeamDialogController.changeNewName(newValue ?? "");
}
