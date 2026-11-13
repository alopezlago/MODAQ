// Everything about the microphone and read-along worth attaching to a bug report: what the browser offers, what the
// moderator turned on, what the follower is doing now, and the recent log. Built synchronously so a page can save it
// while it's being hidden; the parts the browser only answers asynchronously (permission, devices) are kept current
// in the background once a game starts watching.

import { UIState } from "../state/UIState";
import { getReadAlongLog, getReadAlongLogStart } from "./ReadAlongLog";
import { isBraveBrowser, WebSpeechEngine } from "./WebSpeechEngine";

let watchedUIState: UIState | undefined;
let microphonePermission = "unknown";
let audioInputs: string[] | undefined;
let listening = false;

/** Makes the diagnostics describe this game's settings (the most recent game to call it wins). */
export function watchReadAlongState(uiState: UIState): void {
    watchedUIState = uiState;
    if (listening) {
        return;
    }

    listening = true;
    refreshAudioInputs();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshAudioInputs);
    navigator.permissions
        ?.query({ name: "microphone" as PermissionName })
        .then((status) => {
            microphonePermission = status.state;
            status.addEventListener("change", () => {
                microphonePermission = status.state;
                // Device names only become readable once the microphone is allowed
                refreshAudioInputs();
            });
        })
        .catch(() => (microphonePermission = "unknown (browser won't say)"));
}

function refreshAudioInputs(): void {
    navigator.mediaDevices
        ?.enumerateDevices?.()
        .then((devices) => {
            audioInputs = devices
                .filter((device) => device.kind === "audioinput")
                .map((device) => device.label || "(name hidden until the microphone is allowed)");
        })
        .catch(() => (audioInputs = undefined));
}

export function getReadAlongDiagnostics(): string {
    const uiState: UIState | undefined = watchedUIState;
    const yesNo = (value: boolean | undefined) => (value == undefined ? "?" : value ? "yes" : "no");
    const logStart: number | undefined = getReadAlongLogStart();
    const log: string = getReadAlongLog();

    const lines: string[] = [
        `Read-along diagnostics, captured ${new Date().toISOString()}`,
        `Browser: ${navigator.userAgent}${isBraveBrowser() ? " (Brave)" : ""}`,
        `Page: ${location.pathname}${location.search}`,
        `Secure context: ${yesNo(window.isSecureContext)}`,
        `Web Speech recognition available: ${yesNo(WebSpeechEngine.isSupported())}`,
        `Microphone permission: ${microphonePermission}`,
        `Audio inputs: ${
            audioInputs == undefined ? "unknown" : audioInputs.length === 0 ? "none" : audioInputs.join(" | ")
        }`,
        "",
        `Follow reading with microphone: ${yesNo(uiState?.trackReaderWithMicrophone)}`,
        `Show reader position while reading: ${yesNo(uiState?.showReaderPositionWhileReading)}`,
        `Instant highlight: ${yesNo(uiState?.instantReaderHighlight)}`,
        `Buzz point word offset: ${uiState?.buzzPointWordOffset ?? "?"}`,
        `Buzz menu instead of player pad: ${yesNo(uiState?.useBuzzMenu)}`,
        `Engine: ${uiState?.readerFollowerEngine ?? "(not started)"}`,
        `Status: ${uiState?.readerFollowerStatus ?? "(none reported)"}`,
        `Last heard: ${uiState?.readerFollowerTranscript ?? "(nothing)"}`,
        `Live reader position: ${uiState?.readerFollowerLivePosition ?? "?"}`,
        `Selected word: ${uiState?.selectedWordIndex ?? "?"}`,
        `Last cue: ${uiState?.readerFollowerLastCue ?? "(none)"}`,
        `Restarts: ${uiState?.readerFollowerRestartCount ?? "?"}`,
        "",
        logStart == undefined
            ? "Log: (nothing logged yet)"
            : `Log (times from ${new Date(logStart).toISOString()}):\n${log}`,
    ];
    return lines.join("\n");
}
