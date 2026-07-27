import * as React from "react";
import { IPublicRoomState, IStuckAlert, KlaxonClient } from "./klaxonClient";

// The native Klaxon buzz panel shown beside the MODAQ reader. It renders the
// latency-fair buzz queue the Klaxon server resolves and gives the moderator the
// same reset/next/clear controls a Klaxon reader has, so they can drive the
// buzzer while scoring in MODAQ.
// Whether a key event targets a text field, where "r" should be typed rather
// than reset the buzzer.
function isTextEntry(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (el == null || el.tagName == undefined) {
        return false;
    }
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true;
}

// Insistent rising triple-beep, twice — synthesized so there is no asset to
// load or fail. Matches the plain reader view's stuck-buzzer alert.
function playStuckSound(): void {
    try {
        const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
            .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor == undefined) return;
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
        const t = ctx.currentTime;
        for (const start of [0, 0.55]) {
            [
                [784, 0],
                [988, 0.13],
                [1319, 0.26],
            ].forEach(([freq, delay]) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = "square";
                const at = t + start + delay;
                o.frequency.setValueAtTime(freq, at);
                g.gain.setValueAtTime(0.0001, at);
                g.gain.exponentialRampToValueAtTime(0.8, at + 0.008);
                g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
                o.connect(g).connect(master);
                o.start(at);
                o.stop(at + 0.2);
            });
        }
        setTimeout(() => void ctx.close(), 2000);
    } catch {
        /* audio unavailable */
    }
}

function notifyStuck(code: string, who: string): void {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
        const n = new Notification(`Room ${code}: buzzer isn't clear`, {
            body: `${who} is waiting to be recognized.`,
            tag: "klaxon-stuck-" + code,
        });
        n.onclick = (): void => {
            window.focus();
            n.close();
        };
    } catch {
        /* notifications unavailable */
    }
}

export function BuzzPanel(props: { client: KlaxonClient; state: IPublicRoomState | undefined }): JSX.Element {
    const { client, state } = props;
    const [stuck, setStuck] = React.useState<IStuckAlert | undefined>(undefined);

    // A player says the buzzer was never cleared: banner + sound + a browser
    // notification, so a moderator reading in another tab still catches it.
    React.useEffect(() => {
        return client.onStuckAlert((alert) => {
            setStuck(alert);
            playStuckSound();
            notifyStuck(client.code, alert.name + (alert.team ? ` (${alert.team})` : ""));
        });
    }, [client]);

    // Notification permission has to be requested from a user gesture.
    React.useEffect(() => {
        if (typeof Notification === "undefined" || Notification.permission !== "default") return;
        const ask = (): void => {
            document.removeEventListener("pointerdown", ask);
            document.removeEventListener("keydown", ask);
            try {
                void Notification.requestPermission();
            } catch {
                /* older callback-style API */
            }
        };
        document.addEventListener("pointerdown", ask);
        document.addEventListener("keydown", ask);
        return () => {
            document.removeEventListener("pointerdown", ask);
            document.removeEventListener("keydown", ask);
        };
    }, []);

    // In MODAQ mode Space drives the MODAQ buzz menu, so "r" resets the Klaxon
    // buzzer (matching Space-to-reset in the plain reader view).
    React.useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
                return;
            }
            if ((event.key === "r" || event.key === "R") && !isTextEntry(event.target)) {
                event.preventDefault();
                client.resetBuzzer();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [client]);

    const queue = state?.queue ?? [];
    const buzzed = queue.length > 0;

    // Resetting the buzzer resolves the complaint.
    React.useEffect(() => {
        if (!buzzed) {
            setStuck(undefined);
        }
    }, [buzzed]);

    const queueMode = !!state?.settings?.queueMode;
    const players = (state?.members ?? []).filter((m) => m.role === "player");
    const offline = players.filter((p) => !p.connected).length;

    return (
        <div className="klaxon-buzz">
            <h2 className="klaxon-buzz-title">Buzzer</h2>

            {stuck != undefined && (
                <div className="klaxon-stuck" role="alert">
                    <span>
                        ⚠ {stuck.name}
                        {stuck.team ? ` (${stuck.team})` : ""} says the buzzer isn&apos;t clear.
                    </span>
                    <button onClick={() => setStuck(undefined)}>Dismiss</button>
                </div>
            )}

            <div className={"klaxon-phase " + (buzzed ? "buzzed" : "ready")}>
                {buzzed ? queue[0].name + (queue.length > 1 ? ` · ${queue.length - 1} more` : "") : "Ready to buzz"}
            </div>

            <ol className="klaxon-queue">
                {queue.length === 0 && <li className="empty">No buzzes yet.</li>}
                {queue.map((entry, index) => (
                    <li key={entry.playerId} className={index === 0 ? "head" : ""}>
                        <span className="qname">{entry.name}</span>
                        {index > 0 && <span className="qmargin">+{entry.marginMs}ms</span>}
                    </li>
                ))}
            </ol>

            <div className="klaxon-controls">
                <button onClick={() => client.resetBuzzer()} disabled={!buzzed} title="Shortcut: r">
                    Reset buzzer (r)
                </button>
                {queueMode && (
                    <button onClick={() => client.nextBuzz()} disabled={!buzzed}>
                        Next buzzer →
                    </button>
                )}
                {queueMode && (
                    <button onClick={() => client.clearQueue()} disabled={!buzzed}>
                        Clear queue
                    </button>
                )}
            </div>

            <div className="klaxon-players">
                <h3>
                    Players ({players.length}){offline > 0 && <span className="klaxon-offline"> · {offline} offline</span>}
                </h3>
                <ul>
                    {players.length === 0 && <li className="empty">No players connected.</li>}
                    {players
                        .slice()
                        .sort((a, b) => Number(a.connected) - Number(b.connected))
                        .map((player) => (
                            <li key={player.id} className={player.connected ? "" : "gone"}>
                                {player.name}
                                {player.team ? ` · ${player.team}` : ""}
                                {!player.connected && <span className="klaxon-offline"> OFFLINE</span>}
                            </li>
                        ))}
                </ul>
            </div>

            <p className="klaxon-hint">
                Buzzes are resolved with Klaxon&apos;s latency-fair timing. Judge the buzz in the MODAQ reader on the
                left; press <kbd>r</kbd> (or the button) to reset for the next tossup.
            </p>
        </div>
    );
}
