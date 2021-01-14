import * as React from "react";
import { observer } from "mobx-react";
import {
    ContextualMenuItemType,
    IContextualMenuItem,
    IButtonProps,
    ICommandBarItemProps,
    CommandBar,
} from "@fluentui/react";

//// import * as Sheets from "src/sheets/Sheets";
import { GameState } from "src/state/GameState";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import { Bonus } from "src/state/PacketState";
import { AddPlayerDialog } from "./AddPlayerDialog";
import { Player } from "src/state/TeamState";
import { ITossupAnswerEvent } from "src/state/Events";
import { ExportDialog } from "./ExportDialog";

const overflowProps: IButtonProps = { ariaLabel: "More" };

export const GameBar = observer(
    (props: IGameBarProps): JSX.Element => {
        // This should pop up the new game handler
        const newGameHandler = React.useCallback(() => {
            props.uiState.createPendingNewGame();
        }, [props]);
        const protestBonusHandler = React.useCallback(() => {
            // Issue: pending protest needs existing index. Need to update it to include the part number
            // Means bonus protest dialog should include a dropdown or radio box
            const cycle: Cycle = props.game.cycles[props.uiState.cycleIndex];
            if (cycle == undefined || cycle.bonusAnswer == undefined) {
                return;
            }

            const bonusIndex: number = props.game.getBonusIndex(props.uiState.cycleIndex);
            const bonus: Bonus | undefined = props.game.packet.bonuses[bonusIndex];
            if (bonus == undefined) {
                // Something is wrong... the bonus is undefined, but this handler can be accessed?
                throw new Error(`Impossible to add bonus protest for bonus question ${bonusIndex}`);
            }

            const protestableParts: number[] = cycle.getProtestableBonusPartIndexes(bonus.parts.length);
            props.uiState.setPendingBonusProtest(cycle.bonusAnswer.receivingTeamName, bonusIndex, protestableParts[0]);
        }, [props]);
        const addPlayerHandler = React.useCallback(() => {
            props.uiState.createPendingNewPlayer(props.game.teamNames[0]);
        }, [props]);

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

        return (
            <>
                <CommandBar items={items} overflowButtonProps={overflowProps} />
                <AddPlayerDialog game={props.game} uiState={props.uiState} />
                <ExportDialog game={props.game} uiState={props.uiState} />
            </>
        );
    }
);

async function googleSheetsDemo(props: IGameBarProps): Promise<void> {
    // TODO: we should prompt the player, then get the URL and round, and pass that into Sheets
    // Could make it its own component
    // return Sheets.exportToSheet(props.game, props.uiState);

    props.uiState.createPendingSheet();
    return;
}

function getActionSubMenuItems(
    props: IGameBarProps,
    addPlayerHandler: () => void,
    protestBonusHandler: () => void
): ICommandBarItemProps[] {
    const items: ICommandBarItemProps[] = [];

    const teamNames: string[] = props.game.teamNames;
    const swapActivePlayerMenus: ICommandBarItemProps[] = [];
    for (const teamName of teamNames) {
        const players: Player[] = props.game.getPlayers(teamName);
        const activePlayers: Set<Player> = props.game.getActivePlayers(teamName, props.uiState.cycleIndex);

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

    const cycle: Cycle = props.game.cycles[props.uiState.cycleIndex];
    let protestBonusItem: ICommandBarItemProps | undefined = undefined;
    if (cycle && cycle.bonusAnswer != undefined) {
        const bonusIndex: number = props.game.getBonusIndex(props.uiState.cycleIndex);
        const bonus: Bonus = props.game.packet.bonuses[bonusIndex];
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

    items.push({
        key: "copyBuzzPoints",
        text: "Copy buzz points",
        onClick: () => {
            const teamNames: string[] = props.game.teamNames;
            const buzzPoints: [number?, number?][] = props.game.cycles.map((cycle) => {
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
            googleSheetsDemo(props);
        },
        // TODO: This won't update when gapi does; it needs another prop change
        // I don't like commenting out code, but this isn't ready yet, and the work needs to be handed over
        disabled: window.gapi == undefined,
        // disabled: true,
    });

    // TODO: Blob should probably be memoized, so we don't keep stringifying? It does appear that the link is the same
    // if the cycles haven't changed.
    const cyclesJson = new Blob([JSON.stringify(props.game.cycles)], { type: "application/json" });
    items.push({
        key: "downloadJson",
        text: "Download events (JSON)",
        href: URL.createObjectURL(cyclesJson),
        download: `${props.game.teamNames.join("_")}_Events.json`,
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

    item.data.props.game.cycles[item.data.props.uiState.cycleIndex].addPlayerLeaves(item.data.activePlayer);
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

    item.data.props.game.cycles[item.data.props.uiState.cycleIndex].addSwapSubstitution(
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
    game: GameState;
    uiState: UIState;
}

interface ISubMenuItemData {
    props: IGameBarProps;
    activePlayer: Player;
    player?: Player;
}
