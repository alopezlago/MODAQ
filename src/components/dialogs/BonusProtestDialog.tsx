import * as React from "react";
import { observer } from "mobx-react-lite";
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown";

import { ProtestDialogBase } from "./ProtestDialogBase";
import { Cycle } from "src/state/Cycle";
import { IBonusAnswerPart, IBonusProtestEvent } from "src/state/Events";
import { Bonus } from "src/state/PacketState";
import { AppState } from "src/state/AppState";

export const BonusProtestDialog = observer(
    function BonusProtestDialog(props: IBonusProtestDialogProps): JSX.Element  {
        const partChangeHandler = React.useCallback(
            (ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
                if (option?.text != undefined) {
                    props.appState.uiState.updatePendingBonusProtestPart(option.key);
                }
            },
            [props]
        );

        const submitHandler = React.useCallback(() => onSubmit(props), [props]);
        const hideHandler = React.useCallback(() => props.appState.uiState.resetPendingBonusProtest(), [props]);

        const protestEvent: IBonusProtestEvent | undefined = props.appState.uiState.pendingBonusProtestEvent;
        if (protestEvent == undefined) {
            // We shouldn't be showing anything if there's no pending bonus protest. Return undefined.
            return <></>;
        }

        const partOptions: IDropdownOption[] = props.cycle
            .getProtestableBonusPartIndexes(props.bonus.parts.length)
            .map((index) => {
                const partText: string = (index + 1).toString();
                return {
                    key: index,
                    text: partText,
                    selected: protestEvent.partIndex === index,
                };
            });

        const children: JSX.Element = <Dropdown label="Part" options={partOptions} onChange={partChangeHandler} />;

        return (
            <ProtestDialogBase
                appState={props.appState}
                givenAnswer={protestEvent.givenAnswer}
                hidden={props.appState.uiState.pendingBonusProtestEvent == undefined}
                hideDialog={hideHandler}
                onSubmit={submitHandler}
                reason={protestEvent.reason}
            >
                {children}
            </ProtestDialogBase>
        );
    }
);

function onSubmit(props: IBonusProtestDialogProps): void {
    const pendingProtestEvent: IBonusProtestEvent | undefined = props.appState.uiState.pendingBonusProtestEvent;
    let teamName = "";
    if (props.cycle.correctBuzz != undefined && props.cycle.bonusAnswer != undefined) {
        const bonusTeamName: string = props.cycle.correctBuzz.marker.player.teamName;
        const part: IBonusAnswerPart | undefined =
            pendingProtestEvent != undefined ? props.cycle.bonusAnswer.parts[pendingProtestEvent.partIndex] : undefined;

        // If a bonus part was wrong (points <= 0) and the part isn't assigned to anyone, or it's assigned to the team
        // who got the question right, then the team protesting must be the team who got the question right
        // Otherwise, some other team is protesting.
        // TODO: If we ever support more than two teams, we'll have to get the protesting team from the UI
        teamName =
            part == undefined || (part.points <= 0 && (part.teamName === bonusTeamName || part.teamName === ""))
                ? bonusTeamName
                : props.appState.game.teamNames.find((name) => name !== bonusTeamName) ?? "";
    }

    if (pendingProtestEvent) {
        props.cycle.addBonusProtest(
            pendingProtestEvent.questionIndex,
            pendingProtestEvent.partIndex,
            pendingProtestEvent.givenAnswer,
            pendingProtestEvent.reason,
            teamName
        );
        props.appState.uiState.resetPendingBonusProtest();
    }
}

export interface IBonusProtestDialogProps {
    appState: AppState;
    bonus: Bonus;
    cycle: Cycle;
}
