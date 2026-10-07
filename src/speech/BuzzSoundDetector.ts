import { keepAudioContextRunning } from "./AudioContextUtils";

// Buzzers produce a loud, sustained, narrowband tone at a fixed pitch, which looks very different from speech in a
// frequency spectrum. Detect one by looking for a dominant frequency that stands far above the rest of the
// spectrum and holds the same pitch for a quarter of a second. Speech can briefly look tonal too (a held vowel), but
// its pitch keeps moving, so the steady-pitch requirement is what keeps a reader's voice from counting as a buzz.

// How often to analyze the spectrum
const analysisIntervalInMs = 40;

// Only look for tones in the range buzzers actually use; this also ignores low-frequency room rumble
const minimumToneFrequencyInHz = 300;
const maximumToneFrequencyInHz = 4000;

// The peak has to be at least this loud...
const minimumPeakInDb = -45;

// ...and stand this far above the median of the band to count as a tone rather than speech
const minimumPeakOverMedianInDb = 30;

// The tone has to last this many consecutive frames (~250 ms), so clicks, pops and short tonal bits of speech don't
// count; buzzers sound for half a second or more
const requiredConsecutiveFrames = 7;

// ...at a steady pitch: the peak stays within this many frequency bins (about ±50 Hz) of where the tone started
const maximumPitchDriftInBins = 2;

// Ignore further tones for a bit after firing, since one buzz sound spans many frames
const cooldownInMs = 1500;

/**
 * Listens to the microphone and fires a callback when it hears a buzzer-like sound: a loud, sustained tone.
 */
export class BuzzSoundDetector {
    private readonly onBuzzSound: () => void;

    private active: boolean;

    private mediaStream: MediaStream | undefined;

    private audioContext: AudioContext | undefined;

    private analyser: AnalyserNode | undefined;

    private intervalId: number | undefined;

    private stopResumingAudioContext: (() => void) | undefined;

    private consecutiveToneFrames: number;

    // The frequency bin of the current run of tone frames' first peak
    private toneStartBin: number;

    private lastFiredTime: number;

    constructor(onBuzzSound: () => void) {
        this.onBuzzSound = onBuzzSound;
        this.active = false;
        this.mediaStream = undefined;
        this.audioContext = undefined;
        this.analyser = undefined;
        this.intervalId = undefined;
        this.stopResumingAudioContext = undefined;
        this.consecutiveToneFrames = 0;
        this.toneStartBin = -1;
        this.lastFiredTime = 0;
    }

    public static isSupported(): boolean {
        return (
            typeof window !== "undefined" &&
            typeof AudioContext !== "undefined" &&
            navigator.mediaDevices?.getUserMedia != undefined
        );
    }

    public start(): void {
        this.active = true;
        void this.initialize();
    }

    public stop(): void {
        this.active = false;

        if (this.intervalId != undefined) {
            window.clearInterval(this.intervalId);
            this.intervalId = undefined;
        }

        this.analyser = undefined;

        this.stopResumingAudioContext?.();
        this.stopResumingAudioContext = undefined;

        if (this.audioContext != undefined) {
            void this.audioContext.close().catch(() => undefined);
            this.audioContext = undefined;
        }

        if (this.mediaStream != undefined) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = undefined;
        }
    }

    private async initialize(): Promise<void> {
        try {
            // Disable processing that could suppress the buzzer tone; we want the raw room audio
            const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });

            if (!this.active) {
                mediaStream.getTracks().forEach((track) => track.stop());
                return;
            }

            this.mediaStream = mediaStream;
            this.audioContext = new AudioContext();
            this.stopResumingAudioContext = keepAudioContextRunning(this.audioContext);

            const source: MediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(mediaStream);
            const analyser: AnalyserNode = this.audioContext.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0;
            source.connect(analyser);
            this.analyser = analyser;

            this.intervalId = window.setInterval(() => this.analyzeFrame(), analysisIntervalInMs);
        } catch (e) {
            // The speech engine surfaces microphone problems to the user; losing buzz detection isn't fatal
            this.stop();
        }
    }

    private analyzeFrame(): void {
        if (this.analyser == undefined || this.audioContext == undefined) {
            return;
        }

        const spectrum: Float32Array = new Float32Array(this.analyser.frequencyBinCount);
        this.analyser.getFloatFrequencyData(spectrum);

        const binWidthInHz: number = this.audioContext.sampleRate / this.analyser.fftSize;
        const startBin: number = Math.max(1, Math.floor(minimumToneFrequencyInHz / binWidthInHz));
        const endBin: number = Math.min(spectrum.length - 1, Math.ceil(maximumToneFrequencyInHz / binWidthInHz));
        if (endBin <= startBin) {
            return;
        }

        const band: number[] = [];
        let peak = -Infinity;
        let peakBin = -1;
        for (let i = startBin; i <= endBin; i++) {
            const value: number = spectrum[i];
            band.push(value);
            if (value > peak) {
                peak = value;
                peakBin = i;
            }
        }

        band.sort((a, b) => a - b);
        const median: number = band[Math.floor(band.length / 2)];

        const isTone: boolean =
            peak >= minimumPeakInDb && isFinite(median) && peak - median >= minimumPeakOverMedianInDb;

        if (!isTone) {
            this.consecutiveToneFrames = 0;
            return;
        }

        // A tone whose pitch moved is a new tone (or speech), so the run starts over from here
        if (this.consecutiveToneFrames === 0 || Math.abs(peakBin - this.toneStartBin) > maximumPitchDriftInBins) {
            this.toneStartBin = peakBin;
            this.consecutiveToneFrames = 0;
        }

        this.consecutiveToneFrames++;
        if (this.consecutiveToneFrames >= requiredConsecutiveFrames) {
            const now: number = Date.now();
            if (now - this.lastFiredTime >= cooldownInMs) {
                this.lastFiredTime = now;
                this.onBuzzSound();
            }
        }
    }
}
