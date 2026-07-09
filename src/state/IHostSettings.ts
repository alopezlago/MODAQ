// Settings supplied by the application hosting MODAQ (e.g. TMS) to gate host-managed UI behavior.
// Grouped into a single object so the public IModaqControlProps surface stays small: hosts pass one
// optional `hostSettings` prop instead of a growing list of individual booleans.
export interface IHostSettings {
    /** Replace the Export submenu with a single "Export Backup" button gated behind a confirmation dialog. */
    promptBeforeExport?: boolean;

    /** In the JSON export dialog, only offer the QBJ export (hide the whole-game / events options). */
    onlyAllowQbjExport?: boolean;

    /**
     * Restrict roster changes because the host manages the roster: hides Add Player, Rename Player, and
     * Rename Team. Substitutions and reordering remain available.
     */
    restrictRosterChanges?: boolean;

    /** The game format is managed by the host: hide "Change Format" and move the Font item to the View menu. */
    disableChangeFormat?: boolean;

    /**
     * The name of the host product, used in dialogs that reference the host (e.g. the Export Backup confirmation
     * message). Falls back to a generic description if not provided.
     */
    productName?: string;
}
