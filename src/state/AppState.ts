import { makeAutoObservable } from "mobx";

import { GameState } from "./GameState";
import { UIState } from "./UIState";

export class AppState {
    public game: GameState;

    public uiState: UIState;

    constructor() {
        makeAutoObservable(this);

        this.game = new GameState();
        this.uiState = new UIState();
    }
}
