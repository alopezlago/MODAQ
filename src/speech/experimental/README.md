# Experimental: OpenAI Whisper speech engine

This folder is an **experimental, opt-in** alternative speech engine that transcribes the microphone with
OpenAI's Whisper model instead of the browser's Web Speech API (Google) or the local Vosk engine. It plugs into
the existing reader-following pipeline through the same `ISpeechEngine` interface.

It is **off by default** and isolated here so it can be removed cleanly (see "Removing it" below).

## How it works

Whisper is not a streaming recognizer — it transcribes complete audio. So the engine records the current
tossup's audio continuously and, every few seconds, re-sends the audio-so-far to the transcription API. The
transcript grows over time and is fed into the same `IncrementalTranscriptProcessor` / `TranscriptAligner`
pipeline as the other engines, so word de-duplication and buzz-point matching work unchanged. The question text
is passed as Whisper's `prompt` to bias recognition toward the expected vocabulary (helps with proper nouns and
quizbowl jargon).

## Enabling it

Set these keys in `localStorage` from the browser DevTools console, then reload:

```js
localStorage.setItem("modaq_experimental_whisper_enabled", "true");
localStorage.setItem("modaq_experimental_whisper_api_key", "sk-...your key...");

// Optional overrides:
localStorage.setItem("modaq_experimental_whisper_model", "whisper-1");        // or "gpt-4o-transcribe"
localStorage.setItem("modaq_experimental_whisper_base_url", "https://api.openai.com/v1");
localStorage.setItem("modaq_experimental_whisper_interval_ms", "3000");        // min 1500
```

To turn it back off without removing the code:

```js
localStorage.setItem("modaq_experimental_whisper_enabled", "false");
```

With it enabled, turn on **Options → Follow reading with microphone**; the debug panel's "Engine" line will read
"OpenAI Whisper (experimental)". Otherwise the app uses the normal Web Speech / Vosk engines.

## Things to know

- **Audio leaves the machine.** The microphone audio is sent to OpenAI (or whatever `base_url` points at). Don't
  use it where that's not acceptable. The local Vosk engine keeps everything on-device.
- **The API key is stored in `localStorage` and sent from the browser**, so it's visible to anyone with access to
  this browser profile / DevTools. Use a key restricted to the audio endpoint, and don't enable this on shared
  machines. (A production version would proxy requests through a backend that holds the key.)
- **Cost / latency.** Because Whisper isn't streaming, the engine re-transcribes the growing audio every few
  seconds. Over a ~40s tossup that's a handful of calls on increasingly long audio, so transcription lag grows
  toward the end of a question and there's a per-question cost. Fine for evaluation, not optimized for production.
- It needs a network connection.

## Removing it

1. Delete this `experimental/` folder.
2. In `../ReaderFollower.ts`, remove the `tryCreateExperimentalWhisperEngine` import and the guarded branch in
   `start()` (revert `this.engine` to the plain `WebSpeechEngine` / `VoskSpeechEngine` selection).

Nothing else in the app depends on this folder.
