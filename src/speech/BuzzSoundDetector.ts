// Buzzers produce a loud, sustained, narrowband tone, which looks very different from speech (broadband) in a
// frequency spectrum. Detect one by looking for a dominant frequency bin that stands far above the rest of the
// spectrum for a couple of consecutive analysis frames.

// How often to analyze the spectrum
const analysisIntervalInMs = 40;

// Only look for tones in the range buzzers actually use; this also ignores low-frequency room rumble
const minimumToneFrequencyInHz = 300;
const maximumToneFrequencyInHz = 4000;

// The peak has to be at least this loud...
const minimumPeakInDb = -45;

// ...and stand this far above the median of the band to count as a tone rather than speech
const minimumPeakOverMedianInDb = 25;

// Require consecutive tone frames so a click or pop doesn't trigger it
const requiredConsecutiveFrames = 2;

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

    private consecutiveToneFrames: number;

    private lastFiredTime: number;

    constructor(onBuzzSound: () => void) {
        this.onBuzzSound = onBuzzSound;
        this.active = false;
        this.mediaStream = undefined;
        this.audioContext = undefined;
        this.analyser = undefined;
        this.intervalId = undefined;
        this.consecutiveToneFrames = 0;
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
        for (let i = startBin; i <= endBin; i++) {
            const value: number = spectrum[i];
            band.push(value);
            if (value > peak) {
                peak = value;
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
