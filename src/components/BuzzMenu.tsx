// Contextual Menu with this state
// Always show menu with Team Names as section headers, and players underneath
// When we have more information in the cycles and the starting lineup, we can filter the menu to whoever is current
// -If there are no wrong buzzes on this word:
// ---> always show Correct | Wrong for the menu items
// - If there is one wrong buzz on this word:
// ---> show Correct | Wrong on that buzzer, and Correct | Wrong (first buzz) | Wrong (second buzz) for others
// https://developer.microsoft.com/en-us/fluentui#/controls/web/contextualmenu

import * as React from "react";
import { observer } from "mobx-react-lite";
import { ContextualMenu, ContextualMenuItemType, IContextualMenuItem } from "@fluentui/react/lib/ContextualMenu";

import * as CompareUtils from "../state/CompareUtils";
import { Player } from "../state/TeamState";
import { Cycle } from "../state/Cycle";
import { Tossup } from "../state/PacketState";
import { IBuzzMarker } from "../state/IBuzzMarker";
import { AppState } from "../state/AppState";
import { ITossupAnswerEvent } from "../state/Events";

export const BuzzMenu = observer(function BuzzMenu(props: IBuzzMenuProps) {
    const onHideBuzzMenu: () => void = React.useCallback(() => onBuzzMenuDismissed(props), [props]);

    const teamNames: string[] = props.appState.game.teamNames;
    const menuItems: IContextualMenuItem[] = [];
    for (const teamName of teamNames) {
        const subMenuItems: IContextualMenuItem[] = getPlayerMenuItems(props, teamName);
        menuItems.push({
            key: `${teamName}_${menuItems.length}_Section`,
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                bottomDivider: true,
                title: teamName,
                items: subMenuItems,
            },
        });
    }

    return (
        <ContextualMenu
            hidden={!props.appState.uiState.buzzMenuState.visible}
            target={props.target}
            items={menuItems}
            onDismiss={onHideBuzzMenu}
            shouldFocusOnMount={true}
            shouldUpdateWhenHidden={true}
        />
    );
});

function getPlayerMenuItems(props: IBuzzMenuProps, teamName: string): IContextualMenuItem[] {
    // TODO: Need to support Wrong (1st buzz) and Wrong (2nd buzz)
    // TODO: Add some highlighting/indicator on the player to show that they have a buzz in a different word

    const players: Set<Player> = props.appState.game.getActivePlayers(teamName, props.appState.uiState.cycleIndex);
    const menuItems: IContextualMenuItem[] = [];

    let index = 0;
    for (const player of players.values()) {
        const topLevelKey = `Team_${teamName}_Player_${index}`;
        const isCorrectChecked: boolean =
            props.cycle.correctBuzz != undefined &&
            CompareUtils.playersEqual(props.cycle.correctBuzz.marker.player, player) &&
            props.cycle.correctBuzz.marker.position === props.wordIndex;
        const isWrongChecked: boolean =
            props.cycle.wrongBuzzes != undefined &&
            props.cycle.wrongBuzzes.findIndex(
                (buzz) =>
                    CompareUtils.playersEqual(buzz.marker.player, player) && buzz.marker.position === props.wordIndex
            ) >= 0;
        const isProtestChecked: boolean =
            props.cycle.tossupProtests?.findIndex((protest) => protest.position === props.wordIndex) != undefined;

        const buzzMenuItemData: IBuzzMenuItemData = { props, player };

        const subMenuItems: IContextualMenuItem[] = [
            {
                key: `${topLevelKey}_correct`,
                text: "Correct",
                data: buzzMenuItemData,
                canCheck: true,
                checked: isCorrectChecked,
                onClick: onCorrectClicked,
            },
            {
                key: `${topLevelKey}_wrong`,
                text: "Wrong",
                data: buzzMenuItemData,
                canCheck: true,
                checked: isWrongChecked,
                onClick: onWrongClicked,
            },
        ];

        if (isWrongChecked || isCorrectChecked) {
            subMenuItems.push({
                key: `${topLevelKey}_protest`,
                text: "Protest",
                data: buzzMenuItemData,
                canCheck: true,
                checked: isProtestChecked,
                onClick: onProtestClicked,
            });
        }

        // TODO: See if we can improve the style, since the background doesn't change on hover. We can look into
        // tagging this with a class name and using react-jss, or using a style on the parent component (much harder to
        // do without folding this back into the render method)
        menuItems.push({
            key: `Team_${teamName}_Player_${index}`,
            text: player.name,
            style: {
                background: isCorrectChecked ? "rgba(0,128,128,0.1)" : isWrongChecked ? "rgba(128,0,0,0.1)" : undefined,
            },
            subMenuProps: {
                items: subMenuItems,
            },
        });

        index++;
    }

    return menuItems;
}

function onBuzzMenuDismissed(props: IBuzzMenuProps): void {
    props.appState.uiState.hideBuzzMenu();

    if (props.appState.uiState.buzzMenuState.clearSelectedWordOnClose) {
        props.appState.uiState.setSelectedWordIndex(-1);
    }
}

function onCorrectClicked(
    ev?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    item?: IContextualMenuItem
) {
    if (item?.data == undefined || !isBuzzMenuItemData(item.data)) {
        // We need access to the player and props
        return;
    }

    const { props, player } = { ...item.data };

    if (item.checked) {
        props.cycle.removeCorrectBuzz();
    } else if (item?.checked === false) {
        // Don't include a bonus index if there should be no bonus for this correct buzz
        // TODO: This is an example of logic that should be moved out of the view layer
        const bonusIndex: number | undefined =
            props.appState.game.gameFormat.overtimeIncludesBonuses ||
            props.appState.uiState.cycleIndex < props.appState.game.gameFormat.regulationTossupCount
                ? props.bonusIndex
                : undefined;

        // If we don't know the number of parts, assume it's 3, which is standard
        const partsCount: number | undefined =
            bonusIndex != undefined && props.appState.game.packet.bonuses[bonusIndex] != undefined
                ? props.appState.game.packet.bonuses[bonusIndex].parts.length
                : 3;

        props.cycle.addCorrectBuzz(
            {
                player,
                position: item.data.props.wordIndex,
                points: props.tossup.getPointsAtPosition(props.appState.game.gameFormat, item.data.props.wordIndex),
            },
            props.tossupNumber - 1,
            props.appState.game.gameFormat,
            bonusIndex,
            partsCount
        );
    }
}

function onWrongClicked(
    ev?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    item?: IContextualMenuItem
) {
    if (item?.data == undefined || !isBuzzMenuItemData(item.data)) {
        // We need access to the player and props
        return;
    }

    const { props, player } = { ...item.data };

    if (item.checked) {
        props.cycle.removeWrongBuzz(player, props.appState.game.gameFormat);
    } else if (item.checked === false) {
        const marker: IBuzzMarker = {
            isLastWord: props.isLastWord,
            player,
            position: props.wordIndex,
            points: 0,
        };

        // If we're at the end of the question, or if there's already been a neg from a different team, then make it a
        // no penalty buzz
        const pointsAtPosition: number = props.tossup.getPointsAtPosition(
            props.appState.game.gameFormat,
            props.wordIndex,
            false
        );
        if (pointsAtPosition < 0) {
            const negBuzz: ITossupAnswerEvent | undefined = props.cycle.wrongBuzzes?.find(
                (buzz) => buzz.marker.points < 0
            );
            if (negBuzz == undefined || negBuzz.marker.player.teamName === player.teamName) {
                marker.points = pointsAtPosition;
            }
        }

        props.cycle.addWrongBuzz(marker, props.tossupNumber - 1, props.appState.game.gameFormat);
    }
}

function onProtestClicked(
    ev?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    item?: IContextualMenuItem
) {
    if (item?.data == undefined || !isBuzzMenuItemData(item.data)) {
        // We need access to the player and props
        return;
    }

    const { props, player } = { ...item.data };

    if (item.checked) {
        props.cycle.removeTossupProtest(player.teamName);
    } else if (item.checked === false) {
        props.appState.uiState.setPendingTossupProtest(player.teamName, props.tossupNumber - 1, props.wordIndex);
    }
}

function isBuzzMenuItemData(data: IBuzzMenuItemData | undefined): data is IBuzzMenuItemData {
    return data?.props !== undefined && data.player !== undefined;
}

export interface IBuzzMenuProps {
    appState: AppState;
    bonusIndex: number;
    cycle: Cycle;
    isLastWord: boolean;
    wordIndex: number;
    target: React.MutableRefObject<null>;
    tossup: Tossup;
    tossupNumber: number;
}

interface IBuzzMenuItemData {
    props: IBuzzMenuProps;
    player: Player;
}
