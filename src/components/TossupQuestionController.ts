import React from "react";
import { AppState } from "../state/AppState";
import { Cycle } from "../state/Cycle";
import { UIState } from "../state/UIState";

export function selectWordFromClick(appState: AppState, event: React.MouseEvent<HTMLDivElement>): void {
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
    uiState.showBuzzMenu(/* clearSelectedWordOnClose */ true);

    event.preventDefault();
    event.stopPropagation();
}

export function selectWordFromKeyboardEvent(appState: AppState, event: React.KeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLDivElement;

    // We're looking for spans with the word index that matches the selectedWordIndex
    const selectedWordIndexString: string = appState.uiState.selectedWordIndex.toString();
    const questionWords: HTMLCollectionOf<HTMLSpanElement> = target.getElementsByTagName("span");
    for (let i = 0; i < questionWords.length; i++) {
        const questionWord: HTMLSpanElement = questionWords[i];

        if (questionWord.getAttribute("data-index") === selectedWordIndexString) {
            appState.uiState.showBuzzMenu(/* clearSelectedWordOnClose */ false);
            break;
        }
    }

    event.preventDefault();
    event.stopPropagation();
}

export function throwOutTossup(appState: AppState, cycle: Cycle, tossupNumber: number): void {
    cycle.addThrownOutTossup(tossupNumber - 1);
    appState.uiState.setSelectedWordIndex(-1);
}
