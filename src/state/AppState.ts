import { configure, observable } from "mobx";

import { GameState } from "./GameState";
import { UIState } from "./UIState";

export class AppState {
    @observable
    public game: GameState;

    @observable
    public uiState: UIState;

    constructor() {
        configure({ enforceActions: "observed", computedRequiresReaction: true });

        this.game = new GameState();
        this.uiState = new UIState();
    }
}
