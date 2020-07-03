// This should be a CommandBar with
// "New Game" button, that pops up a dialog
// An "Actions" or "Event" drop button that let's users do some events, specifically protest bonuses, maybe do subs
//   That drop button should be contextual, so only show bonus protests/throw out bonus if it's relevant, throw out
//   tossusps, etc. No buzz actions, that needs the word information.
// https://developer.microsoft.com/en-us/fluentui#/controls/web/commandbar

import * as React from "react";
import { IButtonProps } from "office-ui-fabric-react/lib/Button";
import { CommandBar, ICommandBarItemProps } from "office-ui-fabric-react/lib/CommandBar";
import { observer } from "mobx-react";
import { GameState } from "src/state/GameState";
import { UIState } from "src/state/UIState";
import { Cycle } from "src/state/Cycle";
import { Bonus } from "src/state/PacketState";

const overflowProps: IButtonProps = { ariaLabel: "More" };

export const GameBar = observer(
    (props: IGameBarProps): JSX.Element => {
        // This should pop up the new game handler
        const newGameHandler = React.useCallback(() => {
            return;
        }, [props]);
        const protestBonusHandler = React.useCallback(() => {
            // Issue: pending protest needs existing index. Need to update it to include the part number
            // Means bonus protest dialog should include a dropdown or radio box
            const cycle: Cycle = props.game.cycles[props.uiState.cycleIndex];
            if (cycle == undefined || cycle.bonusAnswer == undefined) {
                return;
            }

            const bonusIndex: number = props.game.getBonusIndex(props.uiState.cycleIndex);
            const firstWrongPartIndex = cycle.bonusAnswer.correctParts.findIndex(
                (answerPart) => answerPart.points <= 0
            );
            props.uiState.setPendingBonusProtest(cycle.bonusAnswer.receivingTeam, bonusIndex, firstWrongPartIndex);
        }, [props]);

        const items: ICommandBarItemProps[] = [
            {
                key: "newGame",
                text: "New game",
                iconProps: { iconName: "Add " },
                onClick: newGameHandler,
            },
        ];

        // TODO: Look into memoizing; React.useMemo with just props doesn't seem to recognize when the cycle changes.
        const actionSubMenuItems: ICommandBarItemProps[] = getActionSubMenuItems(props, protestBonusHandler);
        items.push({
            key: "actions",
            text: "Actions...",
            subMenuProps: {
                items: actionSubMenuItems,
            },
            disabled: actionSubMenuItems.length === 0,
        });

        // Get the actions, and decide if there are any applicable ones

        return <CommandBar items={items} overflowButtonProps={overflowProps} />;
    }
);

function getActionSubMenuItems(props: IGameBarProps, protestBonusHandler: () => void): ICommandBarItemProps[] {
    const items: ICommandBarItemProps[] = [];

    // TODO: Don't show the item

    const cycle: Cycle = props.game.cycles[props.uiState.cycleIndex];
    if (cycle && cycle.bonusAnswer != undefined) {
        const bonusIndex: number = props.game.getBonusIndex(props.uiState.cycleIndex);
        const bonus: Bonus = props.game.packet.bonsues[bonusIndex];
        if (cycle.getProtestableBonusPartIndexes(bonus.parts.length).length > 0) {
            items.push({
                key: "protestBonus",
                text: "Protest bonus",
                onClick: protestBonusHandler,
            });
        }
    }

    return items;
}

export interface IGameBarProps {
    game: GameState;
    uiState: UIState;
}
