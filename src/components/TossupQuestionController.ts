import { AppState } from "src/state/AppState";
import { Cycle } from "src/state/Cycle";
import { UIState } from "src/state/UIState";

export function selectWord(appState: AppState, event: React.MouseEvent<HTMLDivElement>): void {
    const target = event.target as HTMLDivElement;

    // I'd like to avoid looking for a specific HTML element instead of a class. This would mean giving QuestionWord a
    // fixed class.
    const questionWord: HTMLSpanElement | null = target.closest("span");
    if (questionWord == undefined || questionWord.getAttribute == undefined) {
        return;
    }

    const index = parseInt(questionWord.getAttribute("data-index") ?? "", 10);
    if (index < 0 || isNaN(index)) {
        return;
    }

    const uiState: UIState = appState.uiState;
    const selectedIndex = uiState.selectedWordIndex === index ? -1 : index;
    uiState.setSelectedWordIndex(selectedIndex);
    uiState.showBuzzMenu();

    event.preventDefault();
    event.stopPropagation();
}

export function throwOutTossup(appState: AppState, cycle: Cycle, tossupNumber: number): void {
    cycle.addThrownOutTossup(tossupNumber - 1);
    appState.uiState.setSelectedWordIndex(-1);
}
