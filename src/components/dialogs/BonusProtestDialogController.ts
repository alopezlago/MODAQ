import { AppState } from "../../state/AppState";
import { Cycle } from "../../state/Cycle";
import { IBonusProtestEvent, IBonusAnswerPart } from "../../state/Events";

export function commit(cycle: Cycle): void {
    const appState: AppState = AppState.instance;
    const pendingProtestEvent: IBonusProtestEvent | undefined = appState.uiState.pendingBonusProtestEvent;
    let teamName = "";
    if (cycle.correctBuzz != undefined && cycle.bonusAnswer != undefined) {
        const bonusTeamName: string = cycle.correctBuzz.marker.player.teamName;
        const part: IBonusAnswerPart | undefined =
            pendingProtestEvent != undefined ? cycle.bonusAnswer.parts[pendingProtestEvent.partIndex] : undefined;

        // If a bonus part was wrong (points <= 0) and the part isn't assigned to anyone, or it's assigned to the team
        // who got the question right, then the team protesting must be the team who got the question right
        // Otherwise, some other team is protesting.
        // TODO: If we ever support more than two teams, we'll have to get the protesting team from the UI
        teamName =
            part == undefined || (part.points <= 0 && (part.teamName === bonusTeamName || part.teamName === ""))
                ? bonusTeamName
                : appState.game.teamNames.find((name) => name !== bonusTeamName) ?? "";
    }

    if (pendingProtestEvent) {
        cycle.addBonusProtest(
            pendingProtestEvent.questionIndex,
            pendingProtestEvent.partIndex,
            pendingProtestEvent.givenAnswer,
            pendingProtestEvent.reason,
            teamName
        );
        appState.uiState.resetPendingBonusProtest();
    }
}

export function changePart(part: string | number): void {
    AppState.instance.uiState.updatePendingBonusProtestPart(part);
}

export function cancel(): void {
    AppState.instance.uiState.resetPendingBonusProtest();
}
