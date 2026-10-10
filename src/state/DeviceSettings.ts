/**
 * Settings that belong to the screen, not the game. A host that shares one game between several moderators'
 * screens (a reader and a co-reader) hands each screen the other's whole saved state, settings included. Applied
 * as-is, one moderator turning on microphone tracking turned it on for the other too, and the other screen's next
 * update switched it back off on the reader's -- which stopped the reader follower as soon as the reader moved on
 * to the next tossup. Display preferences had the same problem, just less visibly.
 *
 * Each screen keeps its own values when it applies the other's state. Because every screen does the same, the
 * state it ends up with is the one it would persist anyway, so nothing bounces between them.
 */
export const deviceLocalUiSettings: readonly string[] = [
    // Following the reader with this device's microphone
    "trackReaderWithMicrophone",
    "showReaderPositionWhileReading",
    "instantReaderHighlight",
    "buzzPointWordOffset",
    // How this screen shows the game
    "useBuzzMenu",
    "oneQuestionAtATime",
    "questionFontSize",
    "fontFamily",
    "isScoreVertical",
    "isClockHidden",
    "isEventLogHidden",
    "isPacketNameHidden",
    "isCustomExportStatusHidden",
    "hidePronunciationAnchors",
    "noBonusHighlight",
    "hideBonusOnDeadTossup",
];

/**
 * Puts this screen's device-local settings into a shared snapshot about to be applied, so applying it leaves them
 * as they are. Only settings the snapshot carries are touched.
 */
export function keepDeviceSettings(
    snapshot: { uiState?: Record<string, unknown> } | undefined,
    localUiState: Record<string, unknown>,
    extraSettings: readonly string[] = []
): void {
    const uiState: Record<string, unknown> | undefined = snapshot?.uiState;
    if (uiState == undefined || typeof uiState !== "object") {
        return;
    }

    for (const key of [...deviceLocalUiSettings, ...extraSettings]) {
        if (key in uiState && localUiState[key] !== undefined) {
            uiState[key] = localUiState[key];
        }
    }
}

/**
 * The shared game a screen is about to load from its storage (a host seeding a reload with the room's latest
 * game), with this screen's settings: the ones it had saved, or, on a device that never saved any, none at all,
 * so MODAQ's defaults apply instead of the other moderator's (their microphone tracking above all).
 */
export function withDeviceSettings(
    sharedJson: string,
    localJson: string | null,
    extraSettings: readonly string[] = []
): string {
    try {
        const snapshot = JSON.parse(sharedJson);
        if (snapshot?.uiState == undefined || typeof snapshot.uiState !== "object") {
            return sharedJson;
        }

        let localUiState: Record<string, unknown> | undefined = undefined;
        try {
            localUiState = localJson == null ? undefined : JSON.parse(localJson)?.uiState;
        } catch {
            localUiState = undefined;
        }

        if (localUiState != undefined && typeof localUiState === "object") {
            keepDeviceSettings(snapshot, localUiState, extraSettings);
        } else {
            for (const key of [...deviceLocalUiSettings, ...extraSettings]) {
                delete snapshot.uiState[key];
            }
        }

        return JSON.stringify(snapshot);
    } catch {
        return sharedJson;
    }
}
