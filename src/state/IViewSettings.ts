// The moderator's display preferences. Unlike IHostSettings, which are restrictions the host enforces, these are
// choices the moderator can change from MODAQ's own menus. Hosts can seed them with the `initialViewSettings` prop and
// observe changes with `onViewSettingsChange`.
export interface IViewSettings {
    /** Hide the clock in the game bar. */
    isClockHidden: boolean;

    /** Hide the event log. */
    isEventLogHidden: boolean;

    /** Hide the packet name label. */
    isPacketNameHidden: boolean;

    /** Hide the custom export status. */
    isCustomExportStatusHidden: boolean;

    /** Show the scoreboard vertically instead of horizontally. */
    isScoreVertical: boolean;

    /** Don't highlight answered bonus parts. */
    noBonusHighlight: boolean;

    /** Hide the bonus when no one answered the tossup correctly. */
    hideBonusOnDeadTossup: boolean;

    /** Use the dark theme. */
    useDarkMode: boolean;

    /** The CSS font-family used for questions. This is used as-is, so include any fallback fonts. */
    fontFamily: string;

    /** The question font size, in pixels. */
    questionFontSize: number;

    /** The question text color. If undefined, the theme's color is used. */
    questionFontColor: string | undefined;

    /** The pronunciation guide color. If undefined, the theme's color is used. */
    pronunciationGuideColor: string | undefined;
}
