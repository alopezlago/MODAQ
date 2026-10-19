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
    // The moderator's own scorecard (experimental)
    "roundScorecard",
    // How this screen shows the game
    "useBuzzMenu",
    "oneQuestionAtATime",
    "questionFontSize",
    "fontFamily",
    // ...and the rest of the Font dialog
    "questionFontColor",
    "pronunciationGuideColor",
    "isScoreVertical",
    "isClockHidden",
    "isEventLogHidden",
    "isPacketNameHidden",
    "isCustomExportStatusHidden",
    "hidePronunciationAnchors",
    "noBonusHighlight",
    "hideBonusOnDeadTossup",
];

// --- remembered across games -------------------------------------------------
// A host can give each game its own store (Klaxon: one per round), so a new
// packet began with MODAQ's defaults: the font, the colours and the read-along
// options reset every round. The device's settings are also kept here, apart
// from any game, and put back whenever a game opens.
const deviceSettingsKey = "modaq-device-settings";

export function loadDeviceSettings(storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage()): Record<
    string,
    unknown
> | undefined {
    try {
        const text: string | null | undefined = storage?.getItem(deviceSettingsKey);
        const parsed = text ? JSON.parse(text) : undefined;
        return parsed != undefined && typeof parsed === "object" ? parsed : undefined;
    } catch {
        return undefined;
    }
}

/** The device settings out of a UI state, the ones that have a value. */
export function pickDeviceSettings(uiState: Record<string, unknown>): Record<string, unknown> {
    const settings: Record<string, unknown> = {};
    for (const key of deviceLocalUiSettings) {
        if (uiState[key] !== undefined) {
            settings[key] = uiState[key];
        }
    }
    return settings;
}

export function saveDeviceSettings(
    uiState: Record<string, unknown>,
    storage: Pick<Storage, "setItem"> | undefined = safeLocalStorage()
): void {
    const settings: Record<string, unknown> = pickDeviceSettings(uiState);
    try {
        storage?.setItem(deviceSettingsKey, JSON.stringify(settings));
    } catch {
        /* storage full or unavailable: the game's own store still has them */
    }
}

/** The remembered values for the settings this device has saved; the rest stay as they are. */
export function applyDeviceSettings(uiState: Record<string, unknown>, saved: Record<string, unknown> | undefined): void {
    if (saved == undefined) {
        return;
    }
    for (const key of deviceLocalUiSettings) {
        if (key in saved && saved[key] !== undefined && key in uiState) {
            uiState[key] = saved[key];
        }
    }
}

function safeLocalStorage(): Storage | undefined {
    try {
        return typeof localStorage === "undefined" ? undefined : localStorage;
    } catch {
        return undefined;
    }
}

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
