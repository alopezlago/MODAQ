import * as React from "react";
import { IChatMessage, IProtest, IPublicRoomState, IRoomMember, IStuckAlert, KlaxonClient } from "./klaxonClient";

// The native Klaxon buzz panel shown beside the MODAQ reader. It renders the
// latency-fair buzz queue the Klaxon server resolves and gives the moderator the
// same reset/next/clear controls a Klaxon reader has, so they can drive the
// buzzer while scoring in MODAQ.
// The shootout leaderboard, as the host sees it while reading.
function Leaderboard(props: { rows: { name: string; banked: number; current: number; total: number }[]; packets?: number }): JSX.Element | null {
    if (props.rows.length === 0) {
        return null;
    }
    return (
        <div className="klaxon-board">
            <h3>
                Leaderboard{" "}
                {props.packets ? <span className="kb-packets">{props.packets} packet(s) banked</span> : undefined}
            </h3>
            <ol>
                {props.rows.map((r) => (
                    <li key={r.name}>
                        <span className="kb-name">{r.name}</span>
                        {r.banked !== 0 && (
                            <span className="kb-split">
                                {r.banked} + {r.current}
                            </span>
                        )}
                        <span className="kb-total">{r.total}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

// The message with each mention marked. Split on the names the SERVER
// resolved, and rendered as text nodes rather than markup — a chat message is
// somebody else's typing.
function renderMentions(m: IChatMessage): React.ReactNode {
    const names = (m.mentions ?? []).map((x) => x.name).sort((a, b) => b.length - a.length);
    if (names.length === 0) {
        return m.text;
    }
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp("@(" + escaped.join("|") + ")(?![\\w-])", "gi");
    const out: React.ReactNode[] = [];
    let at = 0;
    let key = 0;
    for (const hit of m.text.matchAll(pattern)) {
        if (hit.index != undefined && hit.index > at) {
            out.push(m.text.slice(at, hit.index));
        }
        out.push(
            <span className="kc-at" key={key++}>
                {hit[0]}
            </span>
        );
        at = (hit.index ?? 0) + hit[0].length;
    }
    out.push(m.text.slice(at));
    return out;
}

// Timestamps the way a chat client does them: the time beside the name that
// starts a run, the whole date and time on hover, and a divider when the log
// crosses into another day (an evening's reading easily passes midnight).
const chatTime = (at: number): string => {
    try {
        return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
        return "";
    }
};

const chatFullTime = (at: number): string => {
    try {
        return new Date(at).toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
};

const dayOf = (at: number): string => new Date(at).toDateString();

function dayLabel(at: number): string {
    const day = dayOf(at);
    const now = new Date();
    if (day === now.toDateString()) {
        return "Today";
    }
    const yesterday = new Date(now.getTime() - 86400000);
    if (day === yesterday.toDateString()) {
        return "Yesterday";
    }
    try {
        return new Date(at).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    } catch {
        return day;
    }
}

/**
 * The room's chat, in the panel the host is already looking at.
 *
 * Whoever creates a shootout from Klaxon's home page lands here, in MODAQ —
 * so without this the person most likely to want the chat is the only one
 * without it. Open by default for the same reason: a chat you have to go and
 * find is a chat nobody uses.
 */
function RoomChat(props: { client: KlaxonClient; initial: IChatMessage[] }): JSX.Element {
    const { client } = props;
    const [messages, setMessages] = React.useState<IChatMessage[]>(props.initial);
    const [draft, setDraft] = React.useState<string>("");
    const [note, setNote] = React.useState<string>("");
    const logRef = React.useRef<HTMLDivElement | null>(null);

    // The state broadcast carries the backlog; live lines arrive on their own
    // event, so a message doesn't wait for the next state push.
    React.useEffect(() => {
        return client.onChatMessage((m) =>
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].slice(-120)))
        );
    }, [client]);

    React.useEffect(() => {
        const log = logRef.current;
        if (log != undefined) {
            log.scrollTop = log.scrollHeight;
        }
    }, [messages]);

    const send = React.useCallback(async () => {
        const text = draft.trim();
        if (text === "") {
            return;
        }
        setDraft("");
        const res = await client.chatSay(text);
        if (res.error != undefined) {
            // Put it back rather than losing what they typed.
            setDraft(text);
            setNote(res.error === "too_fast" ? "One at a time." : res.error);
        } else {
            setNote("");
        }
    }, [client, draft]);

    let lastName: string | undefined = undefined;
    let lastDay: string | undefined = undefined;
    return (
        <div className="klaxon-chat">
            <h3>Chat</h3>
            <div className="kc-log" ref={logRef} data-is-scrollable="true">
                {messages.map((m) => {
                    const newDay = dayOf(m.at) !== lastDay;
                    // A run of lines from one person names them once — but a new
                    // day starts a fresh run, so its first line is labelled.
                    const grouped = m.name === lastName && !newDay;
                    lastName = m.name;
                    lastDay = dayOf(m.at);
                    return (
                        <React.Fragment key={m.id}>
                            {newDay && <div className="kc-day">{dayLabel(m.at)}</div>}
                            <div className={"kc-line" + (grouped ? " kc-cont" : "")} title={chatFullTime(m.at)}>
                                {!grouped && (
                                    <span className={"kc-who" + (m.staff ? " kc-staff" : "")}>
                                        {m.name}
                                        <span className="kc-when">{chatTime(m.at)}</span>
                                    </span>
                                )}
                                <span className="kc-text">{renderMentions(m)}</span>
                            </div>
                        </React.Fragment>
                    );
                })}
                {messages.length === 0 && <div className="kc-empty">Nothing said yet.</div>}
            </div>
            <div className="kc-entry">
                <input
                    value={draft}
                    maxLength={400}
                    placeholder="Say something"
                    onChange={(ev) => setDraft(ev.target.value)}
                    onKeyDown={(ev) => {
                        // The panel's own shortcuts must not fire while typing.
                        ev.stopPropagation();
                        if (ev.key === "Enter") {
                            void send();
                        }
                    }}
                />
                <button onClick={() => void send()}>Send</button>
            </div>
            {note !== "" && <div className="kc-note">{note}</div>}
        </div>
    );
}

// The protests the teams have raised, and the moderator's side of them.
//
// The ACF rules split this in two and so does this panel. A team says
// "protest" at a pause and the moderator notes it (H.2) — that arrives here as
// "noted", and nothing else happens, because play carries on. At the next break
// the moderator opens it (H.3), which is what lets both teams write their
// reasoning; then they enter it in MODAQ's own protest box and confirm it filed.
//
// Only after it is filed can the question be shown to the room: until then it
// is a live packet question, and a room that has seen one cannot unsee it.
function ProtestList(props: { client: KlaxonClient; protests: IProtest[] }): JSX.Element | null {
    const { client, protests } = props;
    const [busy, setBusy] = React.useState<string | null>(null);
    const [note, setNote] = React.useState<string>("");

    const act = React.useCallback(
        async (action: string, id: string, extra?: Record<string, unknown>) => {
            setBusy(id);
            const res = await client.protest(action, id, extra ?? {});
            setBusy(null);
            setNote(res.error ? `Could not do that: ${res.error}` : "");
        },
        [client]
    );

    // The question the room is being shown comes from the packet MODAQ has
    // loaded — the players' side has never had the text.
    const showQuestion = React.useCallback(
        (p: IProtest) => {
            const text = window.prompt(
                `Show the room the text of question ${p.cycle}? Paste or edit what they should see.`,
                ""
            );
            if (text == undefined || text.trim() === "") {
                return;
            }
            void act("protest_show_question", p.id, { text });
        },
        [act]
    );

    if (protests.length === 0) {
        return null;
    }

    return (
        <div className="klaxon-protests">
            <h3>Protests ({protests.length})</h3>
            {note !== "" && <p className="klaxon-protest-note">{note}</p>}
            <ul>
                {protests.map((p) => {
                    const forSide = p.statements.filter((s) => s.side === "for");
                    const againstSide = p.statements.filter((s) => s.side === "against");
                    return (
                        <li key={p.id} className={`klaxon-protest st-${p.status}`}>
                            <div className="kp-head">
                                <strong>Q{p.cycle}</strong>
                                <span className="kp-team">{p.byTeam}</span>
                                <span className="kp-status">{p.status}</span>
                            </div>
                            {p.reasonLabel != undefined && (
                                <div className="kp-reason">
                                    {p.reasonLabel}
                                    {p.rule != undefined && <span className="kp-rule"> {p.rule}</span>}
                                </div>
                            )}
                            {p.statements.length > 0 && (
                                <ul className="kp-says">
                                    {[...forSide, ...againstSide].map((s, i) => (
                                        <li key={i} className={`kp-${s.side}`}>
                                            <span className="kp-who">
                                                {s.name} · {s.side}
                                            </span>
                                            <span className="kp-text">{s.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="kp-actions">
                                {p.status === "lodged" && (
                                    <button disabled={busy === p.id} onClick={() => void act("protest_open", p.id)}>
                                        Take it — let both teams write
                                    </button>
                                )}
                                {p.status === "open" && (
                                    <button disabled={busy === p.id} onClick={() => void act("protest_file", p.id)}>
                                        Filed in MODAQ
                                    </button>
                                )}
                                {p.status === "filed" && !p.questionShown && (
                                    <button disabled={busy === p.id} onClick={() => showQuestion(p)}>
                                        Show the room the question
                                    </button>
                                )}
                                {p.questionShown && <span className="kp-shown">question shown</span>}
                                {p.status !== "filed" && (
                                    <button disabled={busy === p.id} onClick={() => void act("protest_dismiss", p.id)}>
                                        Drop
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

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
    // Why "Show their answer" did nothing, when it did nothing.
    const [showAnswerMsg, setShowAnswerMsg] = React.useState("");

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
    const answerWindow = state?.answers ?? undefined;
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

            <ProtestList client={client} protests={state?.protests ?? []} />

            <div className="klaxon-controls">
                <button
                    onClick={() => client.resetBuzzer()}
                    disabled={!buzzed}
                    title="Shortcut: r — clears without scoring, which records the buzz as accidental"
                >
                    Accidental buzz (r)
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
                {/* Typed answers: the player with the floor sends theirs with Enter, and nothing reveals it on a
                    timer. This is how the reader asks for it — when they've given someone long enough, or when the
                    player is sitting on an answer they haven't sent. */}
                {answerWindow != undefined && (
                    <button
                        onClick={async () => {
                            const res = await client.massinger({ action: "reveal_answer" });
                            if (res?.error != undefined) {
                                setShowAnswerMsg(
                                    res.error === "nothing_typed" ? "They haven't typed anything yet." : res.error
                                );
                                setTimeout(() => setShowAnswerMsg(""), 2500);
                            }
                        }}
                        disabled={!buzzed}
                        title="Put the buzzed-in player's typed answer on the record now"
                    >
                        Show their answer
                    </button>
                )}
            </div>
            {showAnswerMsg !== "" && <div className="klaxon-note">{showAnswerMsg}</div>}
            {(answerWindow?.spoken?.length ?? 0) > 0 && (
                <div className="klaxon-said">
                    <span className="klaxon-said-label">Given: </span>
                    {(answerWindow?.spoken ?? []).join(" \u00b7 ")}
                </div>
            )}

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

            {state?.shootout != undefined && <RoomChat client={client} initial={state.chat ?? []} />}
            {state?.shootout != undefined && <Leaderboard rows={state.shootout.rows} packets={state.shootout.packets} />}

            <p className="klaxon-hint">
                Buzzes are resolved with Klaxon&apos;s latency-fair timing. Judge the buzz in the MODAQ reader on the
                left; press <kbd>r</kbd> (or the button) to reset for the next tossup.
            </p>
        </div>
    );
}
