// EXPERIMENTAL — see README.md in this folder. This whole folder can be deleted to remove the Whisper engine;
// the only other change is the small guarded branch in ../ReaderFollower.ts.

export interface IWhisperConfig {
    /** OpenAI (or compatible) API key, sent as a Bearer token */
    apiKey: string;

    /** Transcription model, e.g. "whisper-1" or "gpt-4o-transcribe" */
    model: string;

    /** Base URL of the API, without a trailing slash. Lets the user point at a proxy or self-hosted endpoint. */
    baseUrl: string;

    /** How often to send accumulated audio for transcription */
    transcriptionIntervalInMs: number;
}

// All settings live in localStorage so the feature is opt-in and leaves no footprint in the app's own state.
// Set them from the browser DevTools console (see README.md).
const enabledKey = "modaq_experimental_whisper_enabled";
const apiKeyKey = "modaq_experimental_whisper_api_key";
const modelKey = "modaq_experimental_whisper_model";
const baseUrlKey = "modaq_experimental_whisper_base_url";
const intervalKey = "modaq_experimental_whisper_interval_ms";

const defaultModel = "whisper-1";
const defaultBaseUrl = "https://api.openai.com/v1";
const defaultIntervalInMs = 3000;
const minimumIntervalInMs = 1500;

/**
 * Returns the Whisper configuration if the experimental engine is enabled and has an API key, otherwise
 * undefined (the normal case, so the rest of the app is unaffected).
 */
export function getWhisperConfig(): IWhisperConfig | undefined {
    if (typeof window === "undefined" || window.localStorage == undefined) {
        return undefined;
    }

    if (localStorage.getItem(enabledKey) !== "true") {
        return undefined;
    }

    const apiKey: string | null = localStorage.getItem(apiKeyKey);
    if (apiKey == undefined || apiKey === "") {
        return undefined;
    }

    const interval = Number(localStorage.getItem(intervalKey));

    return {
        apiKey,
        model: localStorage.getItem(modelKey) || defaultModel,
        baseUrl: (localStorage.getItem(baseUrlKey) || defaultBaseUrl).replace(/\/+$/, ""),
        transcriptionIntervalInMs: isFinite(interval) && interval >= minimumIntervalInMs ? interval : defaultIntervalInMs,
    };
}
