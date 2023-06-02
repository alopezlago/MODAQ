import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    Dropdown,
    IDropdownOption,
    IDialogContentProps,
    DialogType,
    IModalProps,
    ContextualMenu,
    Dialog,
    DialogFooter,
    PrimaryButton,
    DefaultButton,
    Stack,
    Label,
    StackItem,
    IconButton,
    IIconProps,
    IStackTokens,
    DetailsList,
    SelectionMode,
    IColumn,
    CheckboxVisibility,
    IDragDropEvents,
} from "@fluentui/react";

import * as ReorderPlayersDialogController from "../../components/dialogs/ReorderPlayersDialogController";
import { Player } from "../../state/TeamState";
import { AppState } from "../../state/AppState";
import { StateContext } from "../../contexts/StateContext";
import { ReorderPlayersDialogState } from "../../state/ReorderPlayersDialogState";

const content: IDialogContentProps = {
    type: DialogType.normal,
    title: "Reorder Players",
    closeButtonAriaLabel: "Close",
    showCloseButton: true,
    styles: {
        innerContent: {
            display: "flex",
            flexDirection: "column",
        },
    },
};

const modalProps: IModalProps = {
    isBlocking: false,
    dragOptions: {
        moveMenuItemText: "Move",
        closeMenuItemText: "Close",
        menu: ContextualMenu,
    },
    styles: {
        main: {
            top: "25vh",
        },
    },
    topOffsetFixed: true,
};

const buttonTokens: IStackTokens = { childrenGap: 10 };

const dialogBodyTokens: IStackTokens = { childrenGap: 10 };

const columns: IColumn[] = [
    {
        key: "name",
        fieldName: "name",
        name: "name",
        minWidth: 30,
    },
];

const downButtonProps: IIconProps = {
    iconName: "ChevronDown",
};

const upButtonProps: IIconProps = {
    iconName: "ChevronUp",
};

const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
};

const moveDownClassName = "moveDownButton";
const moveUpClassName = "moveUpButton";

// TODO: Look into making a DefaultDialog, which handles the footers and default props
export const ReorderPlayerDialog = observer(function ReorderPlayerDialog(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    return (
        <Dialog
            hidden={appState.uiState.dialogState.reorderPlayersDialog === undefined}
            dialogContentProps={content}
            modalProps={modalProps}
            onDismiss={ReorderPlayersDialogController.hideDialog}
        >
            <ReorderPlayerDialogBody />
            <DialogFooter>
                <PrimaryButton text="OK" onClick={ReorderPlayersDialogController.submit} />
                <DefaultButton text="Cancel" onClick={ReorderPlayersDialogController.hideDialog} />
            </DialogFooter>
        </Dialog>
    );
});

const ReorderPlayerDialogBody = observer(function ReorderPlayerDialogBody(): JSX.Element {
    const appState: AppState = React.useContext(StateContext);

    const [draggedItem, setDraggedItem] = React.useState<Player | undefined>(undefined);
    const [autoFocusIndex, setAutoFocusIndex] = React.useState<number | undefined>(undefined);
    const [autoFocusIsUp, setAutoFocusIsUp] = React.useState<boolean>(false);

    const teamChangeHandler = React.useCallback((ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option?.text != undefined) {
            ReorderPlayersDialogController.changeTeamName(option.text);
            setAutoFocusIndex(undefined);
        }
    }, []);

    const reorderPlayersDialog: ReorderPlayersDialogState | undefined =
        appState.uiState.dialogState.reorderPlayersDialog;
    if (reorderPlayersDialog === undefined) {
        return <></>;
    }

    // This makes sure that the focus stays on the button belonging to the player
    if (autoFocusIndex != undefined) {
        const className: string = autoFocusIsUp ? moveUpClassName : moveDownClassName;
        const element = document.getElementsByClassName(className)[autoFocusIndex] as HTMLButtonElement;
        if (element) {
            element.focus();
        }

        setAutoFocusIndex(undefined);
    }

    const teamOptions: IDropdownOption[] = appState.game.teamNames.map((teamName, index) => {
        return {
            key: index,
            text: teamName,
            selected: reorderPlayersDialog.teamName === teamName,
        };
    });

    const players: Player[] = reorderPlayersDialog.players.filter((p) => p.teamName === reorderPlayersDialog.teamName);

    function renderPlayerRow(player: Player | undefined, index: number | undefined) {
        if (player == undefined || index == undefined || reorderPlayersDialog == undefined) {
            return <></>;
        }

        return (
            <div style={rowStyle}>
                <StackItem>
                    <Label>{player.name}</Label>
                </StackItem>
                <Stack horizontal={true} tokens={buttonTokens}>
                    <StackItem>
                        <IconButton
                            className={moveUpClassName}
                            iconProps={upButtonProps}
                            disabled={index === 0}
                            onClick={() => {
                                ReorderPlayersDialogController.moveForward(player);
                                if (index > 1) {
                                    setAutoFocusIsUp(true);
                                    setAutoFocusIndex(index - 1);
                                }
                            }}
                        />
                    </StackItem>
                    <StackItem>
                        <IconButton
                            className={moveDownClassName}
                            iconProps={downButtonProps}
                            disabled={index >= players.length - 1}
                            onClick={() => {
                                ReorderPlayersDialogController.moveBackward(player);
                                if (index < players.length - 1) {
                                    setAutoFocusIsUp(false);
                                    setAutoFocusIndex(index + 1);
                                }
                            }}
                        />
                    </StackItem>
                </Stack>
            </div>
        );
    }

    function insertBeforeItem(item: Player) {
        if (draggedItem == undefined) {
            return;
        }

        const locationIndex = players.indexOf(item);
        const itemIndex = players.indexOf(draggedItem);
        if (locationIndex !== itemIndex) {
            ReorderPlayersDialogController.movePlayerToIndex(draggedItem, locationIndex);
        }
    }

    const dragDropEvents: IDragDropEvents = {
        canDrag: () => true,
        canDrop: () => true,
        onDragStart: (item?: Player) => {
            setDraggedItem(item);
        },
        onDragEnd: () => {
            setDraggedItem(undefined);
        },
        onDrop: (item?: Player) => {
            if (draggedItem && item) {
                insertBeforeItem(item);
                setDraggedItem(undefined);
            }
        },
    };

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
                <DetailsList
                    checkboxVisibility={CheckboxVisibility.hidden}
                    columns={columns}
                    dragDropEvents={dragDropEvents}
                    isHeaderVisible={false}
                    items={players}
                    onRenderItemColumn={renderPlayerRow}
                    selectionMode={SelectionMode.single}
                ></DetailsList>
            </StackItem>
        </Stack>
    );
});
