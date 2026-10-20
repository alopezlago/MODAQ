import { expect } from "chai";

import { ISpeechEngineCallbacks } from "src/speech/SpeechEngine";
import { WebSpeechEngine } from "src/speech/WebSpeechEngine";

// A browser stand-in: a fake SpeechRecognition that records its sessions, timers that run only when told to, and a
// clock the test moves by hand.

class FakeRecognition {
    public static sessions: FakeRecognition[] = [];

    // Only newer Chrome can say whether an on-device model is installed; set by tests that use one
    public static available: (() => Promise<string>) | undefined = undefined;

    public continuous = false;
    public interimResults = false;
    public lang = "";
    public maxAlternatives = 1;
    public processLocally?: boolean;
    public phrases?: unknown[];
    public onend: (() => void) | null = null;
    public onerror: ((event: { error: string }) => void) | null = null;
    public onresult: ((event: unknown) => void) | null = null;
    public onstart: (() => void) | null = null;
    public aborted = false;

    constructor() {
        FakeRecognition.sessions.push(this);
    }

    public start(): void {
        // Started
    }

    public stop(): void {
        this.onend?.();
    }

    public abort(): void {
        this.aborted = true;
    }

    // One recognition result with the given words, as Chrome reports it
    public hear(transcript: string): void {
        const result = Object.assign([{ transcript, confidence: 1 }], { isFinal: true });
        this.onresult?.({ resultIndex: 0, results: [result] });
    }

    public fail(error: string): void {
        this.onerror?.({ error });
    }
}

class FakePhrase {
    constructor(public phrase: string, public boost?: number) {}
}

interface IBrowser {
    now: number;
    intervals: Map<number, () => void>;
    timeouts: Map<number, () => void>;
    // Advances the clock, then runs the watchdog once (it checks every second)
    tick: (ms: number) => void;
    runTimeouts: () => void;
}

const globals = (globalThis as unknown) as Record<string, unknown>;
let originalNow: () => number;
let originalNavigator: PropertyDescriptor | undefined;

// Not enumerable, so mocha's --check-leaks doesn't count the browser stand-ins as leaked globals
function setGlobal(name: string, value: unknown): void {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: false });
}

function setUpBrowser(options: { brave?: boolean; withPhrases?: boolean } = {}): IBrowser {
    FakeRecognition.sessions = [];
    FakeRecognition.available = undefined;
    let nextId = 1;
    const browser: IBrowser = {
        now: 1000000,
        intervals: new Map(),
        timeouts: new Map(),
        tick: (ms) => {
            browser.now += ms;
            browser.intervals.forEach((callback) => callback());
        },
        runTimeouts: () => {
            const pending = [...browser.timeouts.values()];
            browser.timeouts.clear();
            pending.forEach((callback) => callback());
        },
    };

    Date.now = () => browser.now;
    setGlobal("window", {
        SpeechRecognition: FakeRecognition,
        SpeechRecognitionPhrase: options.withPhrases ? FakePhrase : undefined,
        setInterval: (callback: () => void) => {
            browser.intervals.set(nextId, callback);
            return nextId++;
        },
        clearInterval: (id: number) => browser.intervals.delete(id),
        setTimeout: (callback: () => void) => {
            browser.timeouts.set(nextId, callback);
            return nextId++;
        },
        clearTimeout: (id: number) => browser.timeouts.delete(id),
    });
    setGlobal("document", { documentElement: { lang: "en-US" } });
    setGlobal("navigator", options.brave ? { brave: {} } : {});
    return browser;
}

interface IRecorded {
    callbacks: ISpeechEngineCallbacks;
    statuses: string[];
    errors: string[];
    unavailable: number;
}

function recordCallbacks(withServiceUnavailable = true): IRecorded {
    const recorded: IRecorded = {
        statuses: [],
        errors: [],
        unavailable: 0,
        callbacks: {
            onPartialTranscript: () => undefined,
            onFinalTranscript: () => undefined,
            onStatusChanged: (status) => recorded.statuses.push(status),
            onPermanentError: (message) => recorded.errors.push(message),
        },
    };
    if (withServiceUnavailable) {
        recorded.callbacks.onServiceUnavailable = () => recorded.unavailable++;
    }

    return recorded;
}

const lastSession = (): FakeRecognition => FakeRecognition.sessions[FakeRecognition.sessions.length - 1];

describe("WebSpeechEngineTests", () => {
    beforeEach(() => {
        originalNow = Date.now;
        originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    });

    afterEach(() => {
        Date.now = originalNow;
        delete globals.window;
        delete globals.document;
        if (originalNavigator != undefined) {
            Object.defineProperty(globalThis, "navigator", originalNavigator);
        } else {
            delete globals.navigator;
        }
    });

    describe("silent session watchdog", () => {
        it("Replaces a session that hasn't delivered anything for 8 seconds", () => {
            const browser: IBrowser = setUpBrowser();
            const recorded: IRecorded = recordCallbacks();
            const engine: WebSpeechEngine = new WebSpeechEngine(recorded.callbacks);
            engine.start();
            expect(FakeRecognition.sessions.length).to.equal(1);
            const first: FakeRecognition = lastSession();

            browser.tick(7999);
            expect(first.aborted).to.be.false;

            browser.tick(1);
            expect(first.aborted).to.be.true;
            expect(recorded.statuses).to.include("Nothing heard for 8s; restarting recognition...");

            // The new session starts after a short pause for the microphone to be released
            expect(FakeRecognition.sessions.length).to.equal(1);
            browser.runTimeouts();
            expect(FakeRecognition.sessions.length).to.equal(2);
            engine.stop();
        });
        it("Waits twice as long after each restart in a row, up to 30 seconds", () => {
            const browser: IBrowser = setUpBrowser();
            const engine: WebSpeechEngine = new WebSpeechEngine(recordCallbacks().callbacks);
            engine.start();

            const restartAfter = (ms: number): void => {
                const before: number = FakeRecognition.sessions.length;
                browser.tick(ms - 1);
                expect(FakeRecognition.sessions.length, `not before ${ms}ms`).to.equal(before);
                expect(lastSession().aborted, `not before ${ms}ms`).to.be.false;
                browser.tick(1);
                expect(lastSession().aborted, `at ${ms}ms`).to.be.true;
                browser.runTimeouts();
            };

            restartAfter(8000);
            restartAfter(16000);
            restartAfter(30000);
            restartAfter(30000);
            engine.stop();
        });
        it("Hearing something resets the wait", () => {
            const browser: IBrowser = setUpBrowser();
            const engine: WebSpeechEngine = new WebSpeechEngine(recordCallbacks().callbacks);
            engine.start();
            browser.tick(8000);
            browser.runTimeouts();

            // The second session hears the reader, then goes quiet: 8 seconds again, not 16
            lastSession().hear("this scientist shined light");
            browser.tick(8000);
            expect(lastSession().aborted).to.be.true;
            engine.stop();
        });
        it("A session that hears nothing after being given hint words restarts without them", async () => {
            const browser: IBrowser = setUpBrowser({ withPhrases: true });
            FakeRecognition.available = () => Promise.resolve("available");
            const recorded: IRecorded = recordCallbacks();
            const engine: WebSpeechEngine = new WebSpeechEngine(recorded.callbacks);
            engine.setVocabulary(["photoelectric", "electrodes"]);
            engine.start();
            // On-device availability is checked asynchronously before the first session starts
            await Promise.resolve();
            await Promise.resolve();
            expect(lastSession().phrases?.length).to.equal(2);

            browser.tick(8000);
            expect(recorded.statuses).to.include("Nothing heard for 8s; restarting recognition without hint words...");
            browser.runTimeouts();
            expect(lastSession().phrases).to.be.undefined;

            // A new tossup gets its hint words again
            engine.setVocabulary(["painter", "costume"]);
            browser.runTimeouts();
            expect(lastSession().phrases?.length).to.equal(2);
            engine.stop();
        });
        it("Stops checking once the engine stops", () => {
            const browser: IBrowser = setUpBrowser();
            const engine: WebSpeechEngine = new WebSpeechEngine(recordCallbacks().callbacks);
            engine.start();
            engine.stop();
            expect(browser.intervals.size).to.equal(0);
        });
    });

    describe("unreachable speech service", () => {
        it("Gives up on the browser's service after three network errors with nothing heard", () => {
            const browser: IBrowser = setUpBrowser();
            const recorded: IRecorded = recordCallbacks();
            const engine: WebSpeechEngine = new WebSpeechEngine(recorded.callbacks);
            engine.start();

            for (let i = 0; i < 2; i++) {
                lastSession().fail("network");
                lastSession().stop();
                browser.runTimeouts();
            }

            expect(recorded.unavailable).to.equal(0);
            lastSession().fail("network");
            expect(recorded.unavailable).to.equal(1);
            expect(recorded.errors).to.be.empty;
            // Stopped: no more sessions or checks
            expect(browser.intervals.size).to.equal(0);
        });
        it("Gives up at the first network error in Brave", () => {
            setUpBrowser({ brave: true });
            const recorded: IRecorded = recordCallbacks();
            const engine: WebSpeechEngine = new WebSpeechEngine(recorded.callbacks);
            engine.start();
            lastSession().fail("network");
            expect(recorded.unavailable).to.equal(1);
        });
        it("Keeps retrying network errors once the service has worked", () => {
            const browser: IBrowser = setUpBrowser();
            const recorded: IRecorded = recordCallbacks();
            const engine: WebSpeechEngine = new WebSpeechEngine(recorded.callbacks);
            engine.start();
            lastSession().hear("in one experiment");

            for (let i = 0; i < 4; i++) {
                lastSession().fail("network");
                lastSession().stop();
                browser.runTimeouts();
            }

            expect(recorded.unavailable).to.equal(0);
            expect(recorded.errors).to.be.empty;
            engine.stop();
        });
        it("Reports a permanent error when there's nothing to switch to", () => {
            setUpBrowser({ brave: true });
            const recorded: IRecorded = recordCallbacks(/* withServiceUnavailable */ false);
            const engine: WebSpeechEngine = new WebSpeechEngine(recorded.callbacks);
            engine.start();
            lastSession().fail("network");
            expect(recorded.errors.length).to.equal(1);
            expect(recorded.errors[0]).to.contain("Brave");
        });
    });
});
