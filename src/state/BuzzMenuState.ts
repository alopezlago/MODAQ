export interface BuzzMenuState {
    clearSelectedWordOnClose: boolean;
    visible: boolean;

    // The player chosen with a number key while the menu is open, as an index into the players in menu order
    // (first team's active players, then the second team's)
    selectedPlayerIndex: number | undefined;
}
