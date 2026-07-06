// Settings supplied by the application hosting MODAQ (e.g. TMS) to gate host-managed UI behavior.
// Grouped into a single object so the public IModaqControlProps surface stays small: hosts pass one
// optional `hostSettings` prop instead of a growing list of individual booleans.
export interface IHostSettings {
    /** Replace the Export submenu with a single "Export Backup" button gated behind a confirmation dialog. */
    promptBeforeExport?: boolean;

    /** In the JSON export dialog, only offer the QBJ export (hide the whole-game / events options). */
    onlyAllowQbjExport?: boolean;

    /**
     * The roster is managed by the host, so only substitutions are allowed: the player menu is labeled
     * "Substitutions" and Add Player / Rename Player / Rename Team are hidden. Note the polarity - `true`
     * here means fewer roster actions, not more.
     */
    allowSubstitutions?: boolean;

    /** The game format is managed by the host: hide "Change Format" and move the Font item to the View menu. */
    disableChangeFormat?: boolean;
}
