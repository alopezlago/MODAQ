import * as React from "react";
import { observer } from "mobx-react-lite";
import {
    ContextualMenuItemType,
    IContextualMenuItem,
    IButtonProps,
    ICommandBarItemProps,
    CommandBar,
} from "@fluentui/react";

import { GameState } from "src/state/GameState";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import { Bonus, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";
import { AppState } from "src/state/AppState";
import { ITossupAnswerEvent } from "src/state/Events";

const overflowProps: IButtonProps = { ariaLabel: "More" };

export const GameBar = observer(
    (props: IGameBarProps): JSX.Element => {
        // This should pop up the new game handler
        const uiState: UIState = props.appState.uiState;
        const game: GameState = props.appState.game;

        const newGameHandler = React.useCallback(() => {
            uiState.createPendingNewGame();
            uiState.dialogState.showNewGameDialog();
        }, [uiState]);
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

        const openHelpHandler = React.useCallback(() => props.appState.uiState.dialogState.showHelpDialog(), [props]);

        const items: ICommandBarItemProps[] = [
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

        const optionsSubMenuItems: ICommandBarItemProps[] = getOptionsSubMenuItems(props);
        items.push({
            key: "options",
            text: "Options",
            subMenuProps: {
                items: optionsSubMenuItems,
            },
        });

        // TODO: Look into memoizing; React.useMemo with just props doesn't seem to recognize when the cycle changes.
        const actionSubMenuItems: ICommandBarItemProps[] = getActionSubMenuItems(
            props,
            addPlayerHandler,
            protestBonusHandler
        );
        items.push({
            key: "actions",
            text: "Actions",
            subMenuProps: {
                items: actionSubMenuItems,
            },
        });

        // Google stuff
        const exportSubMenuItems: ICommandBarItemProps[] = getExportSubMenuItems(props);
        items.push({
            key: "export",
            text: "Export",
            subMenuProps: {
                items: exportSubMenuItems,
            },
        });

        items.push({
            key: "help",
            text: "Help...",
            onClick: openHelpHandler,
        });

        return <CommandBar items={items} overflowButtonProps={overflowProps} />;
    }
);

async function exportToSheets(props: IGameBarProps): Promise<void> {
    props.appState.uiState.createPendingSheet();
    return;
}

function getActionSubMenuItems(
    props: IGameBarProps,
    addPlayerHandler: () => void,
    protestBonusHandler: () => void
): ICommandBarItemProps[] {
    const items: ICommandBarItemProps[] = [];
    const uiState: UIState = props.appState.uiState;
    const game: GameState = props.appState.game;

    const teamNames: string[] = props.appState.game.teamNames;
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
                    props,
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
                props,
                activePlayer,
            };
            const removeItem: ICommandBarItemProps = {
                key: `remove_${teamName}_${activePlayer.name}`,
                text: "Remove",
                data: removeItemData,
                onClick: onRemovePlayerClick,
                // TODO: should this be styled in a different color?
            };

            activePlayerMenuItems.push({
                key: `active_${teamName}_${activePlayer.name}`,
                text: activePlayer.name,
                subMenuProps: {
                    items: [subMenuSectionItem, removeItem],
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
    };

    const playerManagementSection: ICommandBarItemProps = {
        key: "playerManagement",
        itemType: ContextualMenuItemType.Section,
        sectionProps: {
            bottomDivider: true,
            title: "Player Management",
            items: [swapPlayerItem, addPlayerItem],
        },
    };

    items.push(playerManagementSection);

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
                    props,
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

    items.push(protestTossupItems);
    items.push(protestBonusItem);

    return items;
}

function getExportSubMenuItems(props: IGameBarProps): ICommandBarItemProps[] {
    const items: ICommandBarItemProps[] = [];
    const game: GameState = props.appState.game;
    const disabled: boolean = props.appState.game.cycles.length === 0;

    items.push({
        key: "exportSheets",
        text: "Export to Sheets...",
        onClick: () => {
            exportToSheets(props);
        },
        disabled,
    });

    // We have to compute this outside of onClick because MobX will complain about reading orderedBuzzes outside of a
    // reaction otherwise
    const buzzPoints: string[] = game.playableCycles.map((cycle) => {
        const result: string[] = [];
        for (const buzz of cycle.orderedBuzzes) {
            result.push(buzz.marker.position.toString(10));
        }

        return result.join("\t");
    });
    items.push({
        key: "copyBuzzPoints",
        text: "Copy buzz points",
        disabled,
        onClick: () => {
            // Translate this to lines of tab delimited strings
            const buzzPointsText: string = buzzPoints.join("\n");
            copyText(buzzPointsText);
        },
    });

    items.push({
        key: "downloadJson",
        text: "Export to JSON...",
        disabled,
        onClick: () => {
            props.appState.uiState.dialogState.showExportToJsonDialog();
        },
    });

    return items;
}

function getOptionsSubMenuItems(props: IGameBarProps): ICommandBarItemProps[] {
    const items: ICommandBarItemProps[] = [];

    items.push({
        key: "font",
        text: "Font...",
        onClick: () => {
            props.appState.uiState.setPendingQuestionFontSize(props.appState.uiState.questionFontSize);
        },
    });

    return items;
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

    const { game, uiState } = item.data.props.appState;

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

    item.data.props.appState.game.cycles[item.data.props.appState.uiState.cycleIndex].addPlayerLeaves(
        item.data.activePlayer
    );
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

    item.data.props.appState.game.cycles[item.data.props.appState.uiState.cycleIndex].addSwapSubstitution(
        item.data.player,
        item.data.activePlayer
    );
}

function isSubMenuItemData(data: ISubMenuItemData | undefined): data is ISubMenuItemData {
    return data?.props !== undefined && data.activePlayer !== undefined;
}

function isTossupProtestMenuItemData(data: ITossupProtestMenuItemData | undefined): data is ITossupProtestMenuItemData {
    return data?.props !== undefined && data.buzz !== undefined;
}

// Adapted from this gist: https://gist.github.com/lgarron/d1dee380f4ed9d825ca7
function copyText(text: string) {
    return new Promise<void>(function (resolve, reject) {
        let success = false;
        function listener(e: ClipboardEvent) {
            if (e == undefined || e.clipboardData == undefined) {
                return;
            }

            e.clipboardData.setData("text/plain", text);
            e.preventDefault();
            success = true;
        }

        document.addEventListener("copy", listener);
        document.execCommand("copy");
        document.removeEventListener("copy", listener);
        if (success) {
            resolve();
        } else {
            reject();
        }
    });
}

export interface IGameBarProps {
    appState: AppState;
}

interface ISubMenuItemData {
    props: IGameBarProps;
    activePlayer: Player;
    player?: Player;
}

interface ITossupProtestMenuItemData {
    props: IGameBarProps;
    buzz: ITossupAnswerEvent;
}
