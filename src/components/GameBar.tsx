import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    ContextualMenuItemType,
    IContextualMenuItem,
    IButtonProps,
    ICommandBarItemProps,
    CommandBar,
} from "@fluentui/react";

import * as BonusQuestionController from "./BonusQuestionController";
import * as TossupQuestionController from "./TossupQuestionController";
import { GameState } from "../state/GameState";
import { UIState } from "../state/UIState";
import { Cycle } from "../state/Cycle";
import { Bonus, Tossup } from "../state/PacketState";
import { Player } from "../state/TeamState";
import { AppState } from "../state/AppState";
import { ITossupAnswerEvent } from "../state/Events";
import { StateContext } from "../contexts/StateContext";
import { StatusDisplayType } from "../state/StatusDisplayType";

const overflowProps: IButtonProps = { ariaLabel: "More" };

export const GameBar = observer(function GameBar(): JSX.Element {
    // This should pop up the new game handler
    const appState: AppState = React.useContext(StateContext);
    const uiState: UIState = appState.uiState;
    const game: GameState = appState.game;

    const newGameHandler = React.useCallback(() => {
        if (appState.game.hasUpdates) {
            // Prompt the user
            uiState.dialogState.showYesNoCancelMessageDialog(
                "Export Game?",
                "The game has changes that haven't been exported. Would you like to export the game before starting a new one?",
                () => {
                    // Open the export dialog, depending on if they have sheets. We should ideally abstract this logic
                    // to another method
                    if (appState.uiState.customExportOptions != undefined) {
                        appState.handleCustomExport(StatusDisplayType.MessageDialog, "NewGame");
                    } else if (appState.uiState.sheetsState.sheetId != undefined) {
                        exportToSheets(appState);
                    } else {
                        // Manual export
                        appState.uiState.dialogState.showExportToJsonDialog();
                    }
                },
                () => {
                    // User doesn't want any updates, so clear them
                    appState.game.markUpdateComplete();
                    uiState.createPendingNewGame();
                    uiState.dialogState.showNewGameDialog();
                }
            );
        } else {
            uiState.createPendingNewGame();
            uiState.dialogState.showNewGameDialog();
        }
    }, [appState, uiState]);
    const importGameHandler = React.useCallback(() => {
        uiState.createPendingNewGame();
        uiState.dialogState.showImportGameDialog();
    }, [uiState]);

    const protestBonusHandler = React.useCallback(() => {
        // Issue: pending protest needs existing index. Need to update it to include the part number
        const cycle: Cycle = game.cycles[uiState.cycleIndex];
        if (cycle?.bonusAnswer == undefined) {
            return;
        }

        const bonusIndex: number = game.getBonusIndex(uiState.cycleIndex);
        const bonus: Bonus | undefined = game.packet.bonuses[bonusIndex];
        if (bonus == undefined) {
            // Something is wrong... the bonus is undefined, but this handler can be accessed?
            throw new Error(`Impossible to add bonus protest for bonus question ${bonusIndex}`);
        }

        const protestableParts: number[] = cycle.getProtestableBonusPartIndexes(bonus.parts.length);
        uiState.setPendingBonusProtest(cycle.bonusAnswer.receivingTeamName, bonusIndex, protestableParts[0]);
    }, [game, uiState]);

    const addPlayerHandler = React.useCallback(() => {
        uiState.createPendingNewPlayer(game.teamNames[0]);
    }, [uiState, game]);

    const addQuestionsHandler = React.useCallback(() => {
        uiState.dialogState.showAddQuestionsDialog();
    }, [uiState]);

    const openHelpHandler = React.useCallback(() => appState.uiState.dialogState.showHelpDialog(), [appState]);

    const reorderPlayersHandler = React.useCallback(() => {
        uiState.dialogState.showReorderPlayersDialog(game.players);
    }, [uiState, game]);

    const items: ICommandBarItemProps[] = appState.uiState.hideNewGame
        ? []
        : [
              {
                  key: "newGame",
                  text: "New game",
                  iconProps: { iconName: "Add" },
                  split: true,
                  subMenuProps: {
                      items: [
                          {
                              key: "newGameSubMenuItem",
                              text: "New game...",
                              iconProps: { iconName: "Add" },
                              onClick: newGameHandler,
                          },
                          {
                              key: "importGame",
                              text: "Import game...",
                              iconProps: { iconName: "Download" },
                              onClick: importGameHandler,
                          },
                      ],
                  },
                  onClick: newGameHandler,
              },
          ];

    const optionsSubMenuItems: ICommandBarItemProps[] = getOptionsSubMenuItems(appState);
    items.push({
        key: "options",
        text: "Options",
        subMenuProps: {
            items: optionsSubMenuItems,
        },
    });

    const viewSubMenuItems: ICommandBarItemProps[] = getViewSubMenuItems(appState);
    items.push({
        key: "view",
        text: "View",
        subMenuProps: {
            items: viewSubMenuItems,
        },
    });

    // TODO: Look into memoizing; React.useMemo with just props doesn't seem to recognize when the cycle changes.
    const actionSubMenuItems: ICommandBarItemProps[] = getActionSubMenuItems(
        appState,
        addPlayerHandler,
        protestBonusHandler,
        reorderPlayersHandler,
        addQuestionsHandler
    );
    items.push({
        key: "actions",
        text: "Actions",
        subMenuProps: {
            items: actionSubMenuItems,
        },
    });

    // If a custom export option is given, only show a button for that export
    if (appState.uiState.customExportOptions == undefined) {
        const exportSubMenuItems: ICommandBarItemProps[] = getExportSubMenuItems(appState);
        items.push({
            key: "export",
            text: "Export",
            subMenuProps: {
                items: exportSubMenuItems,
            },
        });
    } else {
        // This should be a split button, with custom as the default item
        const handleCustomExport: () => void = () => {
            appState.handleCustomExport(StatusDisplayType.MessageDialog, "Menu");
        };

        items.push({
            key: "export",
            text: appState.uiState.customExportOptions.label,
            disabled: appState.game.cycles.length === 0,
            split: true,
            onClick: handleCustomExport,
            subMenuProps: {
                items: [
                    {
                        key: "exportSubMenuItem",
                        text: appState.uiState.customExportOptions.label,
                        disabled: appState.game.cycles.length === 0,
                        onClick: handleCustomExport,
                    },
                    {
                        key: "downloadJson",
                        text: "Backup to JSON...",
                        disabled: appState.game.cycles.length === 0,
                        onClick: () => {
                            appState.uiState.dialogState.showExportToJsonDialog();
                        },
                    },
                ],
            },
        });
    }

    items.push({
        key: "help",
        text: "Help...",
        onClick: openHelpHandler,
    });

    return <CommandBar items={items} overflowButtonProps={overflowProps} />;
});

async function exportToSheets(appState: AppState): Promise<void> {
    appState.uiState.createPendingSheet();
    return;
}

function getActionSubMenuItems(
    appState: AppState,
    addPlayerHandler: () => void,
    protestBonusHandler: () => void,
    reorderPlayersHandler: () => void,
    addQuestionsHandler: () => void
): ICommandBarItemProps[] {
    const items: ICommandBarItemProps[] = [];
    const uiState: UIState = appState.uiState;
    const game: GameState = appState.game;

    const playerManagementSection: ICommandBarItemProps = getPlayerManagementSubMenuItems(
        appState,
        game,
        uiState,
        addPlayerHandler,
        reorderPlayersHandler
    );
    items.push(playerManagementSection);

    const protestsSection: ICommandBarItemProps = getProtestSubMenuItems(appState, game, uiState, protestBonusHandler);
    items.push(protestsSection);

    const removeQuestionSection: ICommandBarItemProps = {
        key: "removeQuestionSection",
        itemType: ContextualMenuItemType.Section,
        sectionProps: {
            bottomDivider: true,
            title: "Remove Question",
            items: [
                {
                    key: "removeTossup",
                    text: "Throw out tossup",
                    onClick: () =>
                        TossupQuestionController.throwOutTossup(
                            appState.game.cycles[appState.uiState.cycleIndex],
                            appState.game.getTossupIndex(appState.uiState.cycleIndex) + 1
                        ),
                    disabled: appState.game.cycles.length === 0,
                },
                {
                    key: "removeBonus",
                    text: "Throw out bonus",
                    onClick: () =>
                        BonusQuestionController.throwOutBonus(
                            appState.game.cycles[appState.uiState.cycleIndex],
                            appState.game.getBonusIndex(appState.uiState.cycleIndex)
                        ),
                    disabled: appState.game.cycles.length === 0,
                },
            ],
        },
    };
    items.push(removeQuestionSection);

    const packetSection: ICommandBarItemProps = {
        key: "packetSection",
        itemType: ContextualMenuItemType.Section,
        sectionProps: {
            bottomDivider: true,
            title: "Packet",
            items: [
                {
                    key: "addMoreQuestions",
                    text: "Add questions...",
                    onClick: addQuestionsHandler,
                    disabled: appState.game.cycles.length === 0,
                },
            ],
        },
    };
    items.push(packetSection);

    return items;
}

function getExportSubMenuItems(appState: AppState): ICommandBarItemProps[] {
    const items: ICommandBarItemProps[] = [];
    const disabled: boolean = appState.game.cycles.length === 0;

    items.push({
        key: "exportSheets",
        text: "Export to Sheets...",
        onClick: () => {
            exportToSheets(appState);
        },
        disabled: disabled || appState.uiState.sheetsState.clientId == undefined,
    });

    items.push({
        key: "downloadJson",
        text: "Export to JSON...",
        disabled,
        onClick: () => {
            appState.uiState.dialogState.showExportToJsonDialog();
        },
    });

    return items;
}

function getOptionsSubMenuItems(appState: AppState): ICommandBarItemProps[] {
    const items: ICommandBarItemProps[] = [];

    items.push(
        {
            key: "changeFormat",
            text: "Change Format...",
            onClick: () => {
                appState.uiState.dialogState.showCustomizeGameFormatDialog(appState.game.gameFormat);
            },
        },
        {
            key: "font",
            text: "Font...",
            onClick: () => {
                appState.uiState.setPendingFontSize(appState.uiState.questionFontSize);
            },
        }
    );

    return items;
}

function getViewSubMenuItems(appState: AppState): ICommandBarItemProps[] {
    let items: ICommandBarItemProps[] = [
        {
            key: "showClock",
            text: "Clock",
            canCheck: true,
            checked: !appState.uiState.isClockHidden,
            onClick: () => appState.uiState.toggleClockVisibility(),
        },
        {
            key: "showEventLog",
            text: "Event Log",
            canCheck: true,
            checked: !appState.uiState.isEventLogHidden,
            onClick: () => appState.uiState.toggleEventLogVisibility(),
        },
    ];

    if (appState.uiState.customExportOptions?.customExportInterval != undefined) {
        items.push({
            key: "showExportStatus",
            text: "Export Status",
            canCheck: true,
            checked: !appState.uiState.isCustomExportStatusHidden,
            onClick: () => appState.uiState.toggleCustomExportStatusVisibility(),
        });
    }

    items = items.concat([
        {
            key: "viewDivider",
            itemType: ContextualMenuItemType.Divider,
        },
        {
            key: "darkMode",
            text: "Dark Mode",
            canCheck: true,
            checked: appState.uiState.useDarkMode,
            onClick: () => {
                appState.uiState.toggleDarkMode();
            },
        },
    ]);

    return items;
}

function getPlayerManagementSubMenuItems(
    appState: AppState,
    game: GameState,
    uiState: UIState,
    addPlayerHandler: () => void,
    reorderPlayersHandler: () => void
): ICommandBarItemProps {
    const teamNames: string[] = game.teamNames;
    const swapActivePlayerMenus: ICommandBarItemProps[] = [];
    for (const teamName of teamNames) {
        const players: Player[] = game.getPlayers(teamName);
        const activePlayers: Set<Player> = game.getActivePlayers(teamName, uiState.cycleIndex);

        // Potential issue: if we have an "add player" sub, they shouldn't appear before they were added?
        const subs: Player[] = players.filter((player) => !activePlayers.has(player));

        const activePlayerMenuItems: ICommandBarItemProps[] = [];
        for (const activePlayer of activePlayers) {
            const subMenuItems: ICommandBarItemProps[] = subs.map((player) => {
                const subItemData: ISubMenuItemData = {
                    appState,
                    activePlayer,
                    player,
                };
                return {
                    key: `sub_${teamName}_${player.name}`,
                    text: player.name,
                    data: subItemData,
                    onClick: onSwapPlayerClick,
                };
            });

            const subMenuSectionItem: ICommandBarItemProps = {
                key: `subs_${teamName}`,
                itemType: ContextualMenuItemType.Section,
                sectionProps: {
                    bottomDivider: true,
                    title: "Substitute",
                    items: subMenuItems,
                },
            };

            const removeItemData: ISubMenuItemData = {
                appState,
                activePlayer,
            };
            const removeItem: ICommandBarItemProps = {
                key: `remove_${teamName}_${activePlayer.name}`,
                text: "Remove",
                data: removeItemData,
                onClick: onRemovePlayerClick,
                // TODO: should this be styled in a different color?
            };
            const renameItem: ICommandBarItemProps = {
                key: `rename_${teamName}_${activePlayer.name}`,
                text: "Rename",
                data: removeItemData,
                onClick: onRenamePlayerClick,
                // TODO: should this be styled in a different color?
            };

            activePlayerMenuItems.push({
                key: `active_${teamName}_${activePlayer.name}`,
                text: activePlayer.name,
                subMenuProps: {
                    items: [subMenuSectionItem, removeItem, renameItem],
                },
            });
        }

        swapActivePlayerMenus.push({
            key: `active_${teamName}`,
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                bottomDivider: true,
                title: teamName,
                items: activePlayerMenuItems,
            },
        });
    }

    // TODO: This should be under a section for player management (add player, subs)
    const swapPlayerItem: ICommandBarItemProps = {
        key: "swapPlayer",
        text: "Substitute/Remove",
        subMenuProps: {
            items: swapActivePlayerMenus,
        },
        disabled: swapActivePlayerMenus.length === 0,
        // This needs its own submenu, with all the starters, then all the possible subs
        // We should disable this if there are no subs available
    };

    const addPlayerItem: ICommandBarItemProps = {
        key: "addNewPlayer",
        text: "Add player...",
        onClick: addPlayerHandler,
        disabled: appState.game.cycles.length === 0,
    };

    const reorderPlayersItem: ICommandBarItemProps = {
        key: "reorderPlayers",
        text: "Reorder players...",
        onClick: reorderPlayersHandler,
        disabled: appState.game.cycles.length === 0,
    };

    return {
        key: "playerManagement",
        itemType: ContextualMenuItemType.Section,
        sectionProps: {
            bottomDivider: true,
            title: "Player Management",
            items: [swapPlayerItem, addPlayerItem, reorderPlayersItem],
        },
    };
}

function getProtestSubMenuItems(
    appState: AppState,
    game: GameState,
    uiState: UIState,
    protestBonusHandler: () => void
): ICommandBarItemProps {
    const cycle: Cycle | undefined =
        uiState.cycleIndex < game.cycles.length ? game.cycles[uiState.cycleIndex] : undefined;

    let protestTossupItems: ICommandBarItemProps | undefined = undefined;
    let protestBonusItem: ICommandBarItemProps | undefined = undefined;

    if (cycle?.orderedBuzzes != undefined) {
        const tossupIndex: number = game.getTossupIndex(uiState.cycleIndex);
        if (tossupIndex !== -1) {
            const protestSubMenuItems: ICommandBarItemProps[] = [];
            for (const buzz of cycle.orderedBuzzes) {
                const { name, teamName } = buzz.marker.player;
                const tossupProtestItemData: ITossupProtestMenuItemData = {
                    appState,
                    buzz,
                };

                const protestExists: boolean =
                    cycle.tossupProtests != undefined &&
                    cycle.tossupProtests.findIndex((protest) => protest.teamName === teamName) >= 0;

                const protestSubMenuItem: ICommandBarItemProps = {
                    key: `protest${teamName}_${name}`,
                    text: `${name} (${teamName})`,
                    canCheck: true,
                    checked: protestExists,
                    data: tossupProtestItemData,
                    onClick: onProtestTossupClick,
                };

                const protestSection: ICommandBarItemProps = {
                    key: `protestSection${teamName}_${name}`,
                    itemType: ContextualMenuItemType.Section,
                    sectionProps: {
                        bottomDivider: true,
                        title: teamName,
                        items: [protestSubMenuItem],
                    },
                };

                protestSubMenuItems.push(protestSection);
            }

            protestTossupItems = {
                key: "protestTossup",
                text: "Protest tossup...",
                subMenuProps: {
                    items: protestSubMenuItems,
                },
                disabled: protestSubMenuItems.length === 0,
            };
        }
    }

    if (cycle?.bonusAnswer != undefined) {
        const bonusIndex: number = game.getBonusIndex(uiState.cycleIndex);
        if (bonusIndex !== -1) {
            const bonus: Bonus = game.packet.bonuses[bonusIndex];
            if (cycle.getProtestableBonusPartIndexes(bonus.parts.length).length > 0) {
                protestBonusItem = {
                    key: "protestBonus",
                    text: "Protest bonus...",
                    onClick: protestBonusHandler,
                };
            }
        }
    }

    if (protestTossupItems == undefined) {
        protestTossupItems = {
            key: "protestTossup",
            text: "Protest tossup...",
            disabled: true,
        };
    }

    if (protestBonusItem == undefined) {
        protestBonusItem = {
            key: "protestBonus",
            text: "Protest bonus...",
            disabled: true,
        };
    }

    return {
        key: "protestSection",
        itemType: ContextualMenuItemType.Section,
        sectionProps: {
            bottomDivider: true,
            title: "Protests",
            items: [protestTossupItems, protestBonusItem],
        },
    };
}

function onProtestTossupClick(
    ev?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    item?: IContextualMenuItem
): void {
    if (item == undefined) {
        return;
    } else if (!isTossupProtestMenuItemData(item.data)) {
        return;
    }

    const { game, uiState } = item.data.appState;

    const cycle: Cycle = game.cycles[uiState.cycleIndex];
    if (cycle?.orderedBuzzes == undefined) {
        return;
    }

    const teamName: string = item.data.buzz.marker.player.teamName;

    // If this item is checked, then clear the protest
    if (item.checked === true) {
        cycle.removeTossupProtest(teamName);
        return;
    }

    const tossupIndex: number = game.getTossupIndex(uiState.cycleIndex);
    const tossup: Tossup | undefined = game.packet.tossups[tossupIndex];
    if (tossup == undefined) {
        // Something is wrong... the tossup is undefined, but this handler can be accessed?
        throw new Error(`Impossible to add tossup protest for tossup question ${tossupIndex}`);
    }

    uiState.setPendingTossupProtest(teamName, tossupIndex, item.data.buzz.marker.position);
}

function onRemovePlayerClick(
    ev?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    item?: IContextualMenuItem
): void {
    if (item == undefined) {
        return;
    } else if (!isSubMenuItemData(item.data)) {
        return;
    }

    const appState: AppState = item.data.appState;

    appState.uiState.dialogState.showOKCancelMessageDialog(
        "Remove Player",
        `Are you sure you want to remove the player "${item.data.activePlayer.name}" from team "${item.data.activePlayer.teamName}"?`,
        () => appState.game.cycles[appState.uiState.cycleIndex].addPlayerLeaves(item.data.activePlayer)
    );
}

function onRenamePlayerClick(
    ev?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    item?: IContextualMenuItem
): void {
    if (item == undefined) {
        return;
    } else if (!isSubMenuItemData(item.data)) {
        return;
    }

    const appState: AppState = item.data.appState;
    appState.uiState.dialogState.showRenamePlayerDialog(item.data.activePlayer);
}

function onSwapPlayerClick(
    ev?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    item?: IContextualMenuItem
): void {
    if (item == undefined) {
        return;
    } else if (!isSubMenuItemData(item.data) || item.data.player == undefined) {
        return;
    }

    const { uiState, game } = item.data.appState;
    const cycleIndex: number = uiState.cycleIndex;
    const halftimeIndex: number = Math.floor(game.gameFormat.regulationTossupCount / 2);

    // If a substitution doesn't happen in the beginning, after halftime, or during OT, ask the reader if a substitution
    // was intended. Otherwise just do the substitution as normal
    if (cycleIndex === 0 || cycleIndex === halftimeIndex || cycleIndex >= game.gameFormat.regulationTossupCount) {
        game.cycles[uiState.cycleIndex].addSwapSubstitution(item.data.player, item.data.activePlayer);
        return;
    }

    const additionalHint: string =
        Math.abs(cycleIndex - halftimeIndex) <= 1
            ? ` If you want to substitue a player at halftime, do it on question ${Math.floor(halftimeIndex + 1)}.`
            : "";
    item.data.appState.uiState.dialogState.showOKCancelMessageDialog(
        "Substitute Player",
        "You are substituting players outside of a normal time (beginning of the game, after halftime, overtime). Are you sure you want to substitute now?" +
            additionalHint,
        () => game.cycles[uiState.cycleIndex].addSwapSubstitution(item.data.player, item.data.activePlayer)
    );
}

function isSubMenuItemData(data: ISubMenuItemData | undefined): data is ISubMenuItemData {
    return data?.appState !== undefined && data.activePlayer !== undefined;
}

function isTossupProtestMenuItemData(data: ITossupProtestMenuItemData | undefined): data is ITossupProtestMenuItemData {
    return data?.appState !== undefined && data.buzz !== undefined;
}

interface ISubMenuItemData {
    appState: AppState;
    activePlayer: Player;
    player?: Player;
}

interface ITossupProtestMenuItemData {
    appState: AppState;
    buzz: ITossupAnswerEvent;
}
