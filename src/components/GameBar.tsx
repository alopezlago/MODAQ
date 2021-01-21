import * as React from "react";
import { observer } from "mobx-react";
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
import { Bonus } from "src/state/PacketState";
import { Player } from "src/state/TeamState";
import { ITossupAnswerEvent } from "src/state/Events";
import { AppState } from "src/state/AppState";

const overflowProps: IButtonProps = { ariaLabel: "More" };

export const GameBar = observer(
    (props: IGameBarProps): JSX.Element => {
        // This should pop up the new game handler
        const uiState: UIState = props.appState.uiState;
        const game: GameState = props.appState.game;

        const newGameHandler = React.useCallback(() => {
            uiState.createPendingNewGame();
        }, [uiState]);
        const protestBonusHandler = React.useCallback(() => {
            // Issue: pending protest needs existing index. Need to update it to include the part number
            const cycle: Cycle = game.cycles[uiState.cycleIndex];
            if (cycle == undefined || cycle.bonusAnswer == undefined) {
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

        const items: ICommandBarItemProps[] = [
            {
                key: "newGame",
                text: "New game",
                iconProps: { iconName: "Add" },
                onClick: newGameHandler,
            },
        ];

        // TODO: Look into memoizing; React.useMemo with just props doesn't seem to recognize when the cycle changes.
        const actionSubMenuItems: ICommandBarItemProps[] = getActionSubMenuItems(
            props,
            addPlayerHandler,
            protestBonusHandler
        );
        items.push({
            key: "actions",
            text: "Actions...",
            subMenuProps: {
                items: actionSubMenuItems,
            },
        });

        // Google stuff
        const exportSubMenuItems: ICommandBarItemProps[] = getExportSubMenuItems(props);
        items.push({
            key: "export",
            text: "Export...",
            subMenuProps: {
                items: exportSubMenuItems,
            },
        });

        // Get the actions, and decide if there are any applicable ones

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
    let protestBonusItem: ICommandBarItemProps | undefined = undefined;
    if (cycle && cycle.bonusAnswer != undefined) {
        const bonusIndex: number = game.getBonusIndex(uiState.cycleIndex);
        const bonus: Bonus = game.packet.bonuses[bonusIndex];
        if (cycle.getProtestableBonusPartIndexes(bonus.parts.length).length > 0) {
            protestBonusItem = {
                key: "protestBonus",
                text: "Protest bonus",
                onClick: protestBonusHandler,
            };
        }
    }

    if (protestBonusItem == undefined) {
        protestBonusItem = {
            key: "protestBonus",
            text: "Protest bonus",
            disabled: true,
        };
    }

    items.push(protestBonusItem);

    return items;
}

function getExportSubMenuItems(props: IGameBarProps): ICommandBarItemProps[] {
    const items: ICommandBarItemProps[] = [];
    const game: GameState = props.appState.game;

    items.push({
        key: "copyBuzzPoints",
        text: "Copy buzz points",
        onClick: () => {
            const teamNames: string[] = game.teamNames;
            const buzzPoints: [number?, number?][] = game.cycles.map((cycle) => {
                const result: [number?, number?] = [undefined, undefined];
                const buzzes: ITossupAnswerEvent[] = cycle.orderedBuzzes;
                for (const buzz of buzzes) {
                    const index: number = buzz.marker.player.teamName === teamNames[0] ? 0 : 1;
                    result[index] = buzz.marker.position;
                }

                return result;
            });

            // Translate this to lines of tab delimited strings
            const buzzPointsText: string = buzzPoints.map((points) => points.join("\t")).join("\n");
            copyText(buzzPointsText);
        },
    });

    items.push({
        key: "exportSheets",
        text: "Export to Sheets",
        onClick: () => {
            exportToSheets(props);
        },
        // TODO: This won't update when gapi does; it needs another prop change
        disabled: window.gapi == undefined,
    });

    // TODO: Blob should probably be memoized, so we don't keep stringifying? It does appear that the link is the same
    // if the cycles haven't changed.
    const cyclesJson = new Blob([JSON.stringify(game.cycles)], { type: "application/json" });
    items.push({
        key: "downloadJson",
        text: "Download events (JSON)",
        href: URL.createObjectURL(cyclesJson),
        download: `${game.teamNames.join("_")}_Events.json`,
    });

    return items;
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
