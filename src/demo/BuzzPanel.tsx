import * as React from "react";
import { IPublicRoomState, IRoomMember, IStuckAlert, KlaxonClient } from "./klaxonClient";

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

// The buzz itself, played the moment the server hears a press — BEFORE the
// reconcile window decides who won it (no name is shown until then).
function playBuzzBeep(): void {
    try {
        const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
            .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor == undefined) return;
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(1175, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 0.4);
        setTimeout(() => void ctx.close(), 800);
    } catch {
        /* audio unavailable */
    }
}

const BUZZ_SOUND_KEY = "bz_modaqBuzzSound";
const buzzSoundOn = (): boolean => localStorage.getItem(BUZZ_SOUND_KEY) !== "0";

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

    // Instant buzz sound: fires on the server's buzz_pending (sent the moment a
    // press lands, before the reconcile window names the winner). One per cycle.
    const [soundOn, setSoundOn] = React.useState(buzzSoundOn());
    const soundedCycle = React.useRef<number | null>(null);
    React.useEffect(() => {
        return client.onBuzzPending((cycleNo) => {
            if (soundedCycle.current === cycleNo) {
                return;
            }
            soundedCycle.current = cycleNo;
            if (buzzSoundOn()) {
                playBuzzBeep();
            }
        });
    }, [client]);

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

    // Bonus timer: a 5-second countdown only this screen sees, for pacing
    // bonus answers. Starts (or restarts) from the button or the "t" key.
    const [timerEnd, setTimerEnd] = React.useState<number | null>(null);
    const [, forceTick] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => {
        if (timerEnd == null) {
            return;
        }
        const iv = setInterval(() => {
            if (Date.now() > timerEnd + 1500) {
                setTimerEnd(null); // "TIME" has been shown; clear it
            } else {
                forceTick();
            }
        }, 100);
        return () => clearInterval(iv);
    }, [timerEnd]);
    const startTimer = React.useCallback(() => setTimerEnd(Date.now() + 5000), []);
    const timerLeft = timerEnd == null ? null : (timerEnd - Date.now()) / 1000;

    // In MODAQ mode Space drives the MODAQ buzz menu, so "r" resets the Klaxon
    // buzzer (matching Space-to-reset in the plain reader view), and "t" runs
    // the bonus timer.
    React.useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
                return;
            }
            if ((event.key === "r" || event.key === "R") && !isTextEntry(event.target)) {
                event.preventDefault();
                client.resetBuzzer();
            }
            if ((event.key === "t" || event.key === "T") && !isTextEntry(event.target)) {
                event.preventDefault();
                startTimer();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [client, startTimer]);

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

    // Clearing out leftovers: players who joined longer than N minutes ago
    // (a previous game's room-full) go in one click.
    const [staleMins, setStaleMins] = React.useState("15");
    const removeStale = (): void => {
        const minutes = Math.max(1, Number(staleMins) || 15);
        if (window.confirm(`Remove every player who joined more than ${minutes} minutes ago?`)) {
            client.massinger({ action: "remove_stale_players", minutes });
        }
    };

    // A link the moderator just picked, shown before the server's state comes
    // back so the select never appears to ignore the click. Dropped as soon as
    // the room agrees (or corrects us).
    const [pendingLinks, setPendingLinks] = React.useState<Record<string, string>>({});
    const linkValue = (m: IRoomMember | undefined): string =>
        m?.rosterPlayer ? `${m.rosterTeam ?? ""}\u0000${m.rosterPlayer}` : "";
    React.useEffect(() => {
        setPendingLinks((pending) => {
            const next: Record<string, string> = {};
            let changed = false;
            for (const [id, value] of Object.entries(pending)) {
                const member = (state?.members ?? []).find((x) => x.id === id);
                if (member != undefined && linkValue(member) === value) {
                    changed = true; // the room caught up
                } else {
                    next[id] = value;
                }
            }
            return changed ? next : pending;
        });
    }, [state]);

    // Buzzes are shown as the MODAQ player they're linked to (name + team from
    // the game being scored), so the panel and the scoresheet always agree.
    // An unlinked buzzer is flagged and gets a picker right where it's needed.
    const roster = state?.roster;
    const memberOf = (playerId: string): IRoomMember | undefined => players.find((p) => p.id === playerId);
    const modaqLabel = (m: IRoomMember | undefined, fallback: string): string =>
        m?.rosterPlayer ? `${m.rosterPlayer}${m.rosterTeam ? ` (${m.rosterTeam})` : ""}` : fallback;
    // What this buzzer called itself when it joined — worth a tooltip once the
    // panel is showing the MODAQ player's name instead.
    const joinedAsTitle = (m: IRoomMember | undefined): string | undefined =>
        m?.rosterPlayer ? `Joined as ${m.name}${m.team ? ` (${m.team})` : ""}` : undefined;
    const linkPicker = (member: IRoomMember | undefined, playerId: string): JSX.Element | null => {
        if (!roster || roster.teams.length === 0) {
            return null;
        }
        const current = pendingLinks[playerId] ?? linkValue(member);
        return (
            <select
                className="klaxon-link-select"
                value={current}
                title="Which MODAQ player this buzzer is scored as — change it any time"
                onChange={(e) => {
                    const value = e.target.value;
                    setPendingLinks((p) => ({ ...p, [playerId]: value }));
                    const [team, player] = value.split("\u0000");
                    // An empty choice clears the link (back to the typed name).
                    client.massinger({ action: "assign_roster_player", playerId, team: team || "", player: player || "" });
                }}
            >
                <option value="">{current ? "unlink (use typed name)" : "link to MODAQ player…"}</option>
                {roster.teams.map((t) => (
                    <optgroup key={t.name} label={t.name}>
                        {t.players.map((p) => (
                            <option key={p} value={`${t.name}\u0000${p}`}>
                                {p}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
        );
    };

    return (
        <div className="klaxon-buzz">
            <h2 className="klaxon-buzz-title">
                Buzzer
                <button
                    className="klaxon-sound-toggle"
                    title={soundOn ? "Buzz sound on — click to mute" : "Buzz sound muted — click to unmute"}
                    aria-pressed={!soundOn}
                    onClick={() => {
                        const next = !soundOn;
                        setSoundOn(next);
                        localStorage.setItem(BUZZ_SOUND_KEY, next ? "1" : "0");
                        if (next) {
                            playBuzzBeep();
                        }
                    }}
                >
                    {soundOn ? "\uD83D\uDD0A" : "\uD83D\uDD07"}
                </button>
            </h2>

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
                {buzzed
                    ? modaqLabel(memberOf(queue[0].playerId), queue[0].name) +
                      (queue.length > 1 ? ` · ${queue.length - 1} more` : "")
                    : "Ready to buzz"}
            </div>

            {timerLeft != null && (
                <div className={"klaxon-timer" + (timerLeft <= 0 ? " done" : "")} aria-hidden="true">
                    {timerLeft <= 0 ? "TIME" : timerLeft.toFixed(1)}
                </div>
            )}

            <ol className="klaxon-queue">
                {queue.length === 0 && <li className="empty">No buzzes yet.</li>}
                {queue.map((entry, index) => {
                    const m = memberOf(entry.playerId);
                    return (
                        <li key={entry.playerId} className={index === 0 ? "head" : ""}>
                            <span
                                className={"qname" + (m?.rosterPlayer ? " klaxon-linked" : "")}
                                title={joinedAsTitle(m)}
                            >
                                {modaqLabel(m, entry.name)}
                            </span>
                            {index > 0 && <span className="qmargin">+{entry.marginMs}ms</span>}
                            {!m?.rosterPlayer && <span className="klaxon-unlinked">not in MODAQ</span>}
                            {!m?.rosterPlayer && linkPicker(m, entry.playerId)}
                        </li>
                    );
                })}
            </ol>

            <div className="klaxon-controls">
                <button onClick={() => client.resetBuzzer()} disabled={!buzzed} title="Shortcut: r">
                    Reset buzzer (r)
                </button>
                <button onClick={startTimer} title="Shortcut: t — a 5-second countdown only you see">
                    5s timer (t)
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
                                <span
                                    className={"klaxon-player-name" + (player.rosterPlayer ? " klaxon-linked" : "")}
                                    title={joinedAsTitle(player)}
                                >
                                    {modaqLabel(player, player.name + (player.team ? ` · ${player.team}` : ""))}
                                    {linkPicker(player, player.id)}
                                    {!player.connected && <span className="klaxon-offline"> OFFLINE</span>}
                                </span>
                                <button
                                    className="klaxon-remove"
                                    title={`Remove ${player.name} from the room`}
                                    aria-label={`Remove ${player.name} from the room`}
                                    onClick={() => {
                                        if (window.confirm(`Remove ${player.name} from the room? They can rejoin from the player link.`)) {
                                            client.massinger({ action: "remove_player", playerId: player.id });
                                        }
                                    }}
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                </ul>
            </div>

            {players.length > 0 && (
                <div className="klaxon-stale">
                    <button onClick={removeStale}>Remove players who joined over</button>
                    <input
                        type="number"
                        min={1}
                        max={999}
                        value={staleMins}
                        onChange={(e) => setStaleMins(e.target.value)}
                        aria-label="Minutes"
                    />
                    <span>min ago</span>
                </div>
            )}

            <p className="klaxon-hint">
                Buzzes are resolved with Klaxon&apos;s latency-fair timing. Judge the buzz in the MODAQ reader on the
                left; press <kbd>r</kbd> (or the button) to reset for the next tossup.
            </p>
        </div>
    );
}
