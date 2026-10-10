import * as React from "react";
import {
    KlaxonApi,
    IBuzzQueueEntry,
    IChatMessage,
    IProtest,
    IPublicRoomState,
    IRoomMember,
    IRecentEvent,
    IShootoutSession,
    IStaffAnswers,
    IStuckAlert,
    KlaxonClient,
} from "./klaxonClient";

// The native Klaxon buzz panel shown beside the MODAQ reader. It renders the
// latency-fair buzz queue the Klaxon server resolves and gives the moderator the
// same reset/next/clear controls a Klaxon reader has, so they can drive the
// buzzer while scoring in MODAQ.

// The board keys a competitor by the name they are known by, trimmed and cut
// to 40 characters (see shootout.board on the server).
const boardKey = (name: string): string => name.replace(/\s+/g, " ").trim().slice(0, 40).toLowerCase();

const ordinal = (n: number): string => {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return `${n}th`;
    return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

/**
 * A shootout's players, its leaderboard and its buzz queue as one list.
 *
 * In a shootout every competitor is their own team, so the roster and the
 * leaderboard were the same twenty names twice. Here each player is one quiet
 * row: rank, name, score. Nothing on it moves or lights up while the reader is
 * reading, except when a player acts: whoever buzzes is lifted out of the list
 * to the top of it, in buzz order, so a buzz from the twentieth row is never
 * scrolled out of sight. The rest scroll in a box of their own, highest score
 * first; presence greys a row and never re-sorts it.
 */
function Standings(props: {
    players: IRoomMember[];
    rows: { name: string; banked: number; current: number; total: number }[];
    packets?: number;
    at?: string;
    queue: IBuzzQueueEntry[];
    label: (m: IRoomMember | undefined, fallback: string) => string;
    picker: (m: IRoomMember | undefined, playerId: string) => JSX.Element | null;
    onRemove: (m: IRoomMember) => void;
}): JSX.Element {
    const { players, rows, queue } = props;
    const scoreOf = new Map(rows.map((r) => [boardKey(r.name), r]));
    const matched = new Set<string>();
    const entries = players.map((m, order) => {
        const key = boardKey(m.displayName ?? m.rosterPlayer ?? m.name);
        matched.add(key);
        const row = scoreOf.get(key);
        return { id: m.id, member: m as IRoomMember | undefined, name: props.label(m, m.name), row, order };
    });
    // Someone removed from the room still has the points they scored.
    for (const r of rows) {
        if (!matched.has(boardKey(r.name)) && r.total !== 0) {
            entries.push({ id: `row:${r.name}`, member: undefined, name: r.name, row: r, order: entries.length });
        }
    }
    const total = (e: { row?: { total: number } }): number => e.row?.total ?? 0;
    entries.sort((a, b) => total(b) - total(a) || a.order - b.order);
    // A rank only for someone who has scored: twenty people tied on nothing
    // is a column of the same number, and nothing to read.
    const anyScore = entries.some((e) => total(e) !== 0);
    const rankOf = new Map<string, number>();
    entries.forEach((e, i) => {
        const prev = entries[i - 1];
        rankOf.set(e.id, prev != undefined && total(prev) === total(e) ? (rankOf.get(prev.id) as number) : i + 1);
    });
    const showSplit = (props.packets ?? 0) > 0;
    const splitTitle = (e: (typeof entries)[number]): string | undefined =>
        showSplit && e.row != undefined ? `${e.row.banked} from earlier packets + ${e.row.current} this packet` : undefined;

    const queued = new Set(queue.map((q) => q.playerId));
    const byId = new Map(entries.map((e) => [e.id, e]));
    const offline = players.filter((p) => !p.connected).length;

    const row = (e: (typeof entries)[number], extra?: JSX.Element): JSX.Element => {
        const m = e.member;
        // A linked competitor is their own team: the picker would only repeat
        // their name. An unlinked one needs it, and it's the one thing on a
        // quiet row that should catch the eye.
        const picker = m != undefined && !m.rosterPlayer ? props.picker(m, m.id) : null;
        return (
            <>
                {anyScore && <span className="ks-rank">{total(e) !== 0 ? rankOf.get(e.id) : ""}</span>}
                <span className="ks-name" title={m?.rosterPlayer ? `Joined as ${m.name}` : e.name}>
                    {e.name}
                </span>
                {extra}
                {picker}
                <span className="ks-score" title={splitTitle(e)}>
                    {total(e)}
                </span>
                {m != undefined && (
                    <button
                        className="ks-remove"
                        title={`Remove ${m.name} from the room`}
                        aria-label={`Remove ${m.name} from the room`}
                        onClick={() => props.onRemove(m)}
                    >
                        ×
                    </button>
                )}
            </>
        );
    };

    return (
        <div className="ks-standings">
            <h3 className="ks-head">
                <span>
                    Standings · {players.length}
                    {offline > 0 && <span className="ks-offline-count"> · {offline} offline</span>}
                </span>
                {props.at != undefined && props.at !== "" && <span className="kb-packets">{props.at}</span>}
            </h3>
            {queue.length > 0 && (
                <ol className="ks-queue" aria-label="Buzz queue">
                    {queue.map((q, i) => {
                        const e = byId.get(q.playerId) ?? {
                            id: q.playerId,
                            member: undefined,
                            name: q.name,
                            row: undefined,
                            order: 0,
                        };
                        const badge = (
                            <span className="ks-badge" title={i > 0 ? `Buzzed this far behind ${queue[0].name}` : undefined}>
                                {ordinal(i + 1)}
                                {i > 0 && ` +${marginText(q.marginMs)}`}
                            </span>
                        );
                        return (
                            <li
                                key={q.playerId}
                                className={"ks-row" + (i === 0 ? " ks-first" : " ks-behind") + (e.member?.connected === false ? " gone" : "")}
                            >
                                {row(e, badge)}
                            </li>
                        );
                    })}
                </ol>
            )}
            <ol className="ks-list" data-is-scrollable="true">
                {entries.length === 0 && <li className="ks-empty">Nobody here yet.</li>}
                {entries
                    .filter((e) => !queued.has(e.id))
                    .map((e) => (
                        <li
                            key={e.id}
                            className={"ks-row" + (e.member == undefined || !e.member.connected ? " gone" : "")}
                            title={e.member == undefined ? "Left the room" : !e.member.connected ? "Offline" : undefined}
                        >
                            {row(e)}
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

// Timestamps: the whole date and time on hover (on the moderator's screen a
// time beside every name is one more thing moving while they read), and a
// divider when the log crosses into another day — an evening's reading easily
// passes midnight.

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
// How far behind the buzz that won it. Milliseconds while that is the unit that
// means something, seconds once the gap is one a person could have counted.
function marginText(ms: number): string {
    const n = Math.max(0, Math.round(ms || 0));
    return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}s`;
}

// Where the evening has got to: "packet 2 of 9 · Round 02".
function packetLabel(session: IShootoutSession | null | undefined): string {
    const at = session?.currentIndex ?? -1;
    const packet = at >= 0 ? session?.packets?.[at] : undefined;
    if (packet == undefined || session == undefined) {
        return "";
    }
    return session.packets.length > 1 ? `packet ${at + 1} of ${session.packets.length} · ${packet.name}` : packet.name;
}

// When the moderator hears the chat: only when somebody @mentions them (the
// default — that is a player asking for them), at every line, or never.
export type ChatSoundMode = "mentions" | "all" | "off";
const CHAT_SOUND_KEY = "bz_modaqChatSound";
export const readChatSound = (): ChatSoundMode => {
    const v = localStorage.getItem(CHAT_SOUND_KEY);
    return v === "all" || v === "off" ? v : "mentions";
};
export const saveChatSound = (mode: ChatSoundMode): void => localStorage.setItem(CHAT_SOUND_KEY, mode);

// What is being typed after the nearest unfinished "@", and who it could be.
// The same rules as the players' picker: an @ starts a mention only at the
// start or after a space, and two words in is long enough to stop guessing.
function mentionPick(
    value: string,
    caret: number,
    people: { id: string; name: string }[]
): { at: number; matches: { id: string; name: string }[]; index: number } | null {
    const upto = value.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at < 0 || (at > 0 && !/\s/.test(upto[at - 1]))) return null;
    const typed = upto.slice(at + 1);
    if (/\s\s/.test(typed) || typed.length > 30) return null;
    const needle = typed.toLowerCase();
    const matches = people.filter((p) => p.name.toLowerCase().startsWith(needle)).slice(0, 6);
    return matches.length > 0 ? { at, matches, index: 0 } : null;
}

function RoomChat(props: {
    client: KlaxonClient;
    initial: IChatMessage[];
    exportUrl: string;
    // Who can be @mentioned: everyone in the room but this page.
    people: { id: string; name: string }[];
    chatSound: ChatSoundMode;
}): JSX.Element {
    const { client } = props;
    const [messages, setMessages] = React.useState<IChatMessage[]>(props.initial);
    const [draft, setDraft] = React.useState<string>("");
    const [note, setNote] = React.useState<string>("");
    const logRef = React.useRef<HTMLDivElement | null>(null);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [pick, setPick] = React.useState<ReturnType<typeof mentionPick>>(null);
    // Long messages are cut to a few lines until clicked, so one essay can't
    // push everything else out of the box.
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
    const typingSentAt = React.useRef(0);
    const stopTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const soundMode = React.useRef(props.chatSound);
    soundMode.current = props.chatSound;
    const mentionsMe = (m: IChatMessage): boolean => (m.mentions ?? []).some((x) => x.id === client.myId);

    // The state broadcast carries the backlog; live lines arrive on their own
    // event, so a message doesn't wait for the next state push. A new line
    // sounds as the moderator asked: never for their own, never for the room's
    // announcements (an answer has its own chime).
    React.useEffect(() => {
        return client.onChatMessage((m) => {
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].slice(-120)));
            if (m.playerId === client.myId || m.system != undefined || soundMode.current === "off") {
                return;
            }
            if ((m.mentions ?? []).some((x) => x.id === client.myId)) {
                playMentionPing();
            } else if (soundMode.current === "all") {
                playChatBlip();
            }
        });
    }, [client]);

    const insertMention = (p: { id: string; name: string }): void => {
        if (pick == null) return;
        const input = inputRef.current;
        const caret = input?.selectionStart ?? draft.length;
        const before = draft.slice(0, pick.at);
        const after = draft.slice(caret).replace(/^\s+/, "");
        setDraft(`${before}@${p.name} ${after}`);
        setPick(null);
        const pos = before.length + p.name.length + 2;
        requestAnimationFrame(() => {
            input?.focus();
            input?.setSelectionRange(pos, pos);
        });
    };

    // The newest lines are always the ones on screen. The log is pinned to its
    // bottom, and stays pinned when the BOX changes size, not only when a line
    // arrives: a buzz lifting rows into the standings, a drawer opening or the
    // window resizing all shrink it, and without this the latest lines slid
    // out of sight under the reader. Scrolling up unpins it (and counts what
    // arrives meanwhile); left alone for a few seconds, it goes back down by
    // itself, because a moderator mid-question never wants to go and do that.
    const pinned = React.useRef(true);
    const scrolledAt = React.useRef(0);
    const [unseen, setUnseen] = React.useState(0);
    const toLatest = React.useCallback(() => {
        const log = logRef.current;
        if (log != undefined) {
            log.scrollTop = log.scrollHeight;
        }
        pinned.current = true;
        setUnseen(0);
    }, []);
    const seen = React.useRef(messages.length);
    React.useLayoutEffect(() => {
        const arrived = Math.max(0, messages.length - seen.current);
        seen.current = messages.length;
        const mine = messages.length > 0 && messages[messages.length - 1].playerId === client.myId;
        if (pinned.current || mine) {
            toLatest();
        } else if (arrived > 0) {
            setUnseen((n) => n + arrived);
        }
    }, [messages, client, toLatest]);
    React.useEffect(() => {
        const log = logRef.current;
        if (log == undefined || typeof ResizeObserver === "undefined") {
            return undefined;
        }
        const keep = new ResizeObserver(() => {
            if (pinned.current) {
                log.scrollTop = log.scrollHeight;
            }
        });
        keep.observe(log);
        return () => keep.disconnect();
    }, []);
    React.useEffect(() => {
        const timer = setInterval(() => {
            const log = logRef.current;
            if (pinned.current || log == undefined || log.matches(":hover")) {
                return;
            }
            if (Date.now() - scrolledAt.current > 8000) {
                toLatest();
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [toLatest]);
    const onScroll = (): void => {
        const log = logRef.current;
        if (log == undefined) return;
        const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
        pinned.current = atBottom;
        if (atBottom) {
            setUnseen(0);
        } else {
            scrolledAt.current = Date.now();
        }
    };

    const sendTyping = React.useCallback(
        (on: boolean) => {
            const now = Date.now();
            if (on && now - typingSentAt.current < 2500) return;
            typingSentAt.current = on ? now : 0;
            client.chatTyping(on);
        },
        [client]
    );

    const send = React.useCallback(async () => {
        const text = draft.trim();
        if (text === "") {
            return;
        }
        setDraft("");
        clearTimeout(stopTimer.current);
        sendTyping(false);
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
            <div className="kc-head">
                <h3>Chat</h3>
                {/* The whole evening, not just what is still on screen: the room
                    keeps far more than a broadcast carries (see shootout.js). */}
                <a
                    className="kc-export"
                    href={props.exportUrl}
                    download
                    title="Download the room's chat as a text file"
                >
                    Export
                </a>
            </div>
            <div className="kc-logwrap">
            <div className="kc-log" ref={logRef} data-is-scrollable="true" onScroll={onScroll}>
                {messages.map((m, i) => {
                    // A day rule at the very top that only says "Today" is a
                    // line of nothing.
                    const newDay = dayOf(m.at) !== lastDay && !(lastDay == undefined && dayLabel(m.at) === "Today");
                    // Questions read with nobody talking between them would
                    // fill the box with "Question 7, Question 8, Question 9":
                    // only the last of a run is drawn.
                    if (m.system === "cycle" && messages[i + 1]?.system === "cycle") {
                        lastDay = dayOf(m.at);
                        return null;
                    }
                    // A run of lines from one person names them once — but a new
                    // day starts a fresh run, so its first line is labelled.
                    const grouped = m.system == undefined && m.name === lastName && !newDay;
                    // An announcement breaks the run: the next line from that
                    // person is named again rather than trailing off an event.
                    lastName = m.system == undefined ? m.name : undefined;
                    lastDay = dayOf(m.at);
                    if (m.system === "cycle") {
                        // Where the room got to, drawn like the day rules around it.
                        return (
                            <React.Fragment key={m.id}>
                                {newDay && <div className="kc-day">{dayLabel(m.at)}</div>}
                                <div className="kc-day kc-cycle" title={chatFullTime(m.at)}>
                                    {m.text}
                                </div>
                            </React.Fragment>
                        );
                    }
                    if (m.system === "answer") {
                        return (
                            <React.Fragment key={m.id}>
                                {newDay && <div className="kc-day">{dayLabel(m.at)}</div>}
                                <div className="kc-event" title={chatFullTime(m.at)}>
                                    <span className="kc-event-label">Answer</span>
                                    <span className="kc-event-who">{m.name}</span>
                                    <span className="kc-event-text">{m.text}</span>
                                </div>
                            </React.Fragment>
                        );
                    }
                    return (
                        <React.Fragment key={m.id}>
                            {newDay && <div className="kc-day">{dayLabel(m.at)}</div>}
                            {/* One line per message: the name runs into the
                                text, and the time is on hover. A name on a line
                                of its own halved how much of the chat fit. */}
                            <div
                                className={
                                    "kc-line kc-inline" +
                                    (grouped ? " kc-cont" : "") +
                                    (mentionsMe(m) ? " kc-at-me" : "") +
                                    (expanded.has(m.id) ? " kc-open" : "")
                                }
                                title={`${chatFullTime(m.at)} — click to show all of a long message`}
                                onClick={() =>
                                    setExpanded((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(m.id)) next.delete(m.id);
                                        else next.add(m.id);
                                        return next;
                                    })
                                }
                            >
                                {!grouped && (
                                    <span className={"kc-who" + (m.staff ? " kc-staff" : "")}>{m.name}</span>
                                )}
                                <span className="kc-text">{renderMentions(m)}</span>
                            </div>
                        </React.Fragment>
                    );
                })}
                {messages.length === 0 && <div className="kc-empty">Nothing said yet.</div>}
            </div>
            {unseen > 0 && (
                <button className="kc-jump" onClick={toLatest}>
                    ↓ {unseen} new
                </button>
            )}
            </div>
            <div className="kc-entry">
                {pick != null && (
                    <ul className="kc-mentions" role="listbox" aria-label="Mention someone">
                        {pick.matches.map((p, i) => (
                            <li
                                key={p.id}
                                role="option"
                                aria-selected={i === pick.index}
                                className={"kc-mention" + (i === pick.index ? " on" : "")}
                                // Before the input's blur, which would close the list.
                                onMouseDown={(ev) => {
                                    ev.preventDefault();
                                    insertMention(p);
                                }}
                            >
                                {p.name}
                            </li>
                        ))}
                    </ul>
                )}
                <input
                    ref={inputRef}
                    value={draft}
                    maxLength={400}
                    placeholder="Say something — @ to mention"
                    onBlur={() => setPick(null)}
                    onChange={(ev) => {
                        setDraft(ev.target.value);
                        setPick(mentionPick(ev.target.value, ev.target.selectionStart ?? ev.target.value.length, props.people));
                        if (ev.target.value.trim() === "") {
                            clearTimeout(stopTimer.current);
                            sendTyping(false);
                            return;
                        }
                        sendTyping(true);
                        clearTimeout(stopTimer.current);
                        stopTimer.current = setTimeout(() => sendTyping(false), 4500);
                    }}
                    onKeyDown={(ev) => {
                        // The panel's own shortcuts must not fire while typing.
                        ev.stopPropagation();
                        // While the picker is open, Enter and Tab finish the
                        // name rather than sending half a mention.
                        if (pick != null) {
                            const n = pick.matches.length;
                            if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
                                ev.preventDefault();
                                const step = ev.key === "ArrowDown" ? 1 : n - 1;
                                setPick({ ...pick, index: (pick.index + step) % n });
                                return;
                            }
                            if (ev.key === "Enter" || ev.key === "Tab") {
                                ev.preventDefault();
                                insertMention(pick.matches[pick.index]);
                                return;
                            }
                            if (ev.key === "Escape") {
                                setPick(null);
                                return;
                            }
                        }
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

// The buzzer's recent history, newest first: who buzzed and how far behind,
// who pressed too late, every clear and next-buzzer and withdrawal, and who did
// it. For the moment a moderator wonders whether they just cleared the wrong
// buzz — and if they did, the clear says so and offers to undo it. The full
// record is the activity log; this is the part worth having on screen.
const recentClock = (at: number): string =>
    new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

export function useRecentBuzzes(client: KlaxonClient): IRecentEvent[] {
    const [recent, setRecent] = React.useState<IRecentEvent[]>(client.recent);
    React.useEffect(() => client.onRecent(setRecent), [client]);
    return recent;
}

// Undo the last clear, saying so if the room had already moved on.
export function useUndoClear(client: KlaxonClient): [(id: string) => void, string] {
    const [msg, setMsg] = React.useState("");
    const undo = React.useCallback(
        async (id: string) => {
            const res = await client.restoreBuzzes(id);
            if (res?.error != undefined) {
                setMsg(
                    res.error === "nobody_to_restore"
                        ? "Everyone it cleared has left or is already back in the queue."
                        : "That clear can't be undone any more — the room has moved on."
                );
                setTimeout(() => setMsg(""), 3000);
            }
        },
        [client]
    );
    return [undo, msg];
}

function RecentBuzzes(props: { events: IRecentEvent[]; onUndo: (id: string) => void; drawer?: boolean }): JSX.Element {
    const { events, onUndo } = props;
    // In a shootout it opens from a button in the panel's header, so it needs
    // no disclosure of its own.
    const Box = props.drawer ? "div" : "details";
    // Collapsed, the list hides its Undo; the newest clear that can still be
    // undone is offered on the summary line, so it is one click either way.
    const undoable = props.drawer ? undefined : events.find((e) => e.undoId != undefined);
    return (
        <Box className={"klaxon-recent" + (props.drawer ? " ks-drawer" : "")}>
            {props.drawer ? (
                <h3>Recent buzzes</h3>
            ) : (
                <summary>
                    Recent buzzes
                    {undoable?.undoId != undefined && (
                        <button
                            className="kr-summary-undo"
                            title="Put the cleared buzzes back in the queue"
                            onClick={(event) => {
                                // A button in a summary would also open or shut the list.
                                event.preventDefault();
                                onUndo(undoable.undoId as string);
                            }}
                        >
                            Undo clear
                        </button>
                    )}
                </summary>
            )}
            {events.length === 0 ? (
                <p className="klaxon-recent-empty">Nothing yet.</p>
            ) : (
                <ol>
                    {events.map((e, i) => (
                        <li key={`${e.at}-${i}`} className={`kr-${e.kind}`}>
                            <time>{recentClock(e.at)}</time>
                            <span className="kr-text">
                                {e.question != undefined && <span className="kr-q">Q{e.question}</span>}
                                {e.text}
                                {e.note != undefined && <span className="kr-note"> · {e.note}</span>}
                            </span>
                            {e.undoId != undefined && (
                                <button onClick={() => onUndo(e.undoId as string)} title="Put the cleared buzzes back in the queue">
                                    Undo
                                </button>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </Box>
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

// An answer has been given. Two rising notes, softer and lower than the buzz,
// because it means "read this" rather than "stop reading" — and the reader is
// usually looking at the question, not at this panel, when it lands.
function playAnswerChime(): void {
    try {
        const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
            .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor == undefined) return;
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
        const t = ctx.currentTime;
        [
            [587, 0],
            [880, 0.12],
        ].forEach(([freq, delay]) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "triangle";
            const at = t + delay;
            o.frequency.setValueAtTime(freq, at);
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(0.7, at + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
            o.connect(g).connect(master);
            o.start(at);
            o.stop(at + 0.26);
        });
        setTimeout(() => void ctx.close(), 900);
    } catch {
        /* audio unavailable */
    }
}

// Short synthesized notes, [frequency, delay] each.
function playNotes(notes: number[][], gain: number, type: OscillatorType, length: number): void {
    try {
        const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
            .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor == undefined) return;
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = gain;
        master.connect(ctx.destination);
        const t = ctx.currentTime;
        for (const [freq, delay] of notes) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = type;
            const at = t + delay;
            o.frequency.setValueAtTime(freq, at);
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(0.7, at + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, at + length);
            o.connect(g).connect(master);
            o.start(at);
            o.stop(at + length + 0.04);
        }
        setTimeout(() => void ctx.close(), 1000);
    } catch {
        /* audio unavailable */
    }
}

// A chat line: one quiet tick, nothing like a buzz or an answer.
function playChatBlip(): void {
    playNotes([[740, 0]], 0.25, "sine", 0.09);
}

// Somebody @mentioned the moderator: brighter, two notes falling — "hey".
function playMentionPing(): void {
    playNotes(
        [
            [1319, 0],
            [988, 0.11],
        ],
        0.5,
        "sine",
        0.16
    );
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
    const soundedWave = React.useRef<string | null>(null);
    React.useEffect(() => {
        return client.onBuzzPending((wave) => {
            // Once per wave. In queue mode a question has several, and the
            // reader has to hear each of them — they stop reading again.
            if (soundedWave.current === wave) {
                return;
            }
            soundedWave.current = wave;
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
    const recent = useRecentBuzzes(client);
    const [undoClear, undoMsg] = useUndoClear(client);
    const undoable = recent.find((e) => e.undoId != undefined);

    // Resetting the buzzer resolves the complaint.
    React.useEffect(() => {
        if (!buzzed) {
            setStuck(undefined);
        }
    }, [buzzed]);

    const queueMode = !!state?.settings?.queueMode;
    const answerWindow = state?.answers ?? undefined;
    // An answer landing is the thing the reader has been waiting for, so it
    // says so out loud. Counted rather than compared: the same answer given
    // twice is still an answer given twice.
    const spokenCount = answerWindow?.spoken?.length ?? 0;
    const [answerFlash, setAnswerFlash] = React.useState(false);
    const heardAnswers = React.useRef(spokenCount);
    React.useEffect(() => {
        if (spokenCount > heardAnswers.current) {
            if (buzzSoundOn()) {
                playAnswerChime();
            }
            setAnswerFlash(true);
            const timer = setTimeout(() => setAnswerFlash(false), 1600);
            heardAnswers.current = spokenCount;
            return () => clearTimeout(timer);
        }
        heardAnswers.current = spokenCount;
        return undefined;
    }, [spokenCount]);
    // Whether players type their answers at all. It is a room setting either
    // way; the point of having it here is that the moderator is HERE, and
    // deciding it shouldn't mean leaving the game to find the buzzer page.
    const typedAnswers = state?.settings?.typedAnswers === true || state?.settings?.lockedAnswers === true;
    // A checkbox bound straight to the room setting ignores the click until the
    // server answers, so it flicks back under the pointer. Show what the
    // moderator just chose, and let go once the room agrees.
    const [pendingTyped, setPendingTyped] = React.useState<boolean | undefined>(undefined);
    React.useEffect(() => {
        if (pendingTyped != undefined && pendingTyped === typedAnswers) {
            setPendingTyped(undefined);
        }
    }, [pendingTyped, typedAnswers]);
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
    // "Olin (Olin)" says nothing twice: a one-player team (a shootout) is just
    // the name.
    const modaqLabel = (m: IRoomMember | undefined, fallback: string): string =>
        m?.rosterPlayer
            ? `${m.rosterPlayer}${m.rosterTeam && m.rosterTeam !== m.rosterPlayer ? ` (${m.rosterTeam})` : ""}`
            : fallback;
    // A shootout keeps its history and its settings behind two header buttons.
    const [drawer, setDrawer] = React.useState<"recent" | "settings" | null>(null);
    const [chatSound, setChatSound] = React.useState<ChatSoundMode>(readChatSound());

    // A shootout panel is exactly as tall as the part of the window it can
    // be seen in, so its chat box sits at the bottom of the screen. The page's
    // header is above it until the reader scrolls, and the panel is sticky
    // after that, so the height follows the scroll.
    const shootoutRef = React.useRef<HTMLDivElement | null>(null);
    const isShootout = state?.shootout != undefined;
    React.useEffect(() => {
        const side = shootoutRef.current?.closest(".mod-side") as HTMLElement | null | undefined;
        if (!isShootout || side == undefined) {
            return undefined;
        }
        let frame = 0;
        const fit = (): void => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const top = Math.max(0, side.getBoundingClientRect().top);
                side.style.setProperty("--ks-side-top", `${Math.round(top)}px`);
            });
        };
        fit();
        window.addEventListener("scroll", fit, { passive: true });
        window.addEventListener("resize", fit);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", fit);
            window.removeEventListener("resize", fit);
            side.style.removeProperty("--ks-side-top");
        };
    }, [isShootout]);
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

    const removePlayer = (player: IRoomMember): void => {
        if (window.confirm(`Remove ${player.name} from the room? They can rejoin from the player link.`)) {
            client.massinger({ action: "remove_player", playerId: player.id });
        }
    };

    const soundButton = (
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
            {soundOn ? "🔊" : "🔇"}
        </button>
    );

    const stuckBanner = stuck != undefined && (
        <div className="klaxon-stuck" role="alert">
            <span>
                ⚠ {stuck.name}
                {stuck.team ? ` (${stuck.team})` : ""} says the buzzer isn&apos;t clear.
            </span>
            <button onClick={() => setStuck(undefined)}>Dismiss</button>
        </div>
    );

    const phaseBar = (
        <div className={"klaxon-phase " + (buzzed ? "buzzed" : "ready")}>
            {buzzed
                ? modaqLabel(memberOf(queue[0].playerId), queue[0].name) +
                  (queue.length > 1 ? ` · ${queue.length - 1} more` : "")
                : "Ready to buzz"}
        </div>
    );

    const timerDisplay = timerLeft != null && (
        <div className={"klaxon-timer" + (timerLeft <= 0 ? " done" : "")} aria-hidden="true">
            {timerLeft <= 0 ? "TIME" : timerLeft.toFixed(1)}
        </div>
    );

    // Right where the clear was pressed, for as long as it can be taken back
    // (the same question, nothing cleared since). Only for a clear without
    // scoring — the slip this is for; one that followed a ruling is undone from
    // the recent-buzzes list.
    const undoButton = undoable?.undoId != undefined && undoable.kind === "clear-accidental" && (
        <button className="klaxon-undo" onClick={() => undoClear(undoable.undoId as string)} title={`Undo: ${undoable.text}`}>
            ↶ Undo clear
        </button>
    );

    // Typed answers: the player with the floor sends theirs with Enter, and
    // nothing reveals it on a timer. This is how the reader asks for it — when
    // they've given someone long enough, or when the player is sitting on an
    // answer they haven't sent.
    const showAnswerButton = answerWindow != undefined && (
        <button
            className="ks-wide"
            onClick={async () => {
                const res = await client.massinger({ action: "reveal_answer" });
                if (res?.error != undefined) {
                    setShowAnswerMsg(res.error === "nothing_typed" ? "They haven't typed anything yet." : res.error);
                    setTimeout(() => setShowAnswerMsg(""), 2500);
                }
            }}
            disabled={!buzzed}
            title="Put the buzzed-in player's typed answer on the record now"
        >
            Show their answer
        </button>
    );

    const notes = (
        <>
            {showAnswerMsg !== "" && <div className="klaxon-note">{showAnswerMsg}</div>}
            {undoMsg !== "" && <div className="klaxon-note">{undoMsg}</div>}
            {(answerWindow?.spoken?.length ?? 0) > 0 && (
                <div className={"klaxon-said" + (answerFlash ? " klaxon-said-new" : "")}>
                    <span className="klaxon-said-label">Given: </span>
                    {(answerWindow?.spoken ?? []).join(" · ")}
                </div>
            )}
        </>
    );

    const typedOption = (
        <label className="klaxon-opt" title="Players type their answer instead of saying it out loud">
            <input
                type="checkbox"
                checked={pendingTyped ?? typedAnswers}
                onChange={(e) => {
                    const on = e.target.checked;
                    setPendingTyped(on);
                    // Off means off: no boxes for anyone, including the
                    // players queued behind the buzzer.
                    client.massinger({
                        action: "set_options",
                        options: on ? { typedAnswers: true } : { typedAnswers: false, lockedAnswers: false },
                    });
                }}
            />{" "}
            Players type their answers
        </label>
    );

    // Being findable is the whole point of a Discord reading: the host posts
    // the link in one server, and anyone else who wants a game can come in off
    // the home page. Off unless they ask — a room's code is the only thing
    // keeping strangers out of it.
    const listedOption = (
        <label className="klaxon-opt" title="Anyone can find this game on klaxonbuzz.com and join it">
            <input
                type="checkbox"
                checked={state?.listed === true}
                onChange={(e) => client.massinger({ action: "set_options", options: { listed: e.target.checked } })}
            />{" "}
            List this game on the Klaxon home page
        </label>
    );

    const staleRow = players.length > 0 && (
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
    );

    // The end of the evening. It sends the room home, so it asks first;
    // reopening doesn't, because nothing is lost by it.
    const endRow = (
        <div className="klaxon-end">
            {state?.ended == undefined ? (
                <button
                    onClick={() => {
                        if (
                            window.confirm(
                                "End the game for everyone? The players are sent home and the room stops taking new ones. The scoresheet, the chat and the log stay, and you can reopen it."
                            )
                        ) {
                            client.massinger({ action: "end_game", end: true });
                        }
                    }}
                    title="Send the players home and close the room"
                >
                    End the game for everyone
                </button>
            ) : (
                <>
                    <span className="klaxon-ended">This game is over.</span>
                    <button onClick={() => client.massinger({ action: "end_game", end: false })}>Reopen it</button>
                </>
            )}
        </div>
    );

    const hints = (
        <>
            <p className="klaxon-hint">
                Buzzes are resolved with Klaxon&apos;s latency-fair timing. Judge the buzz in the MODAQ reader on the
                left; press <kbd>r</kbd> (or the button) to reset for the next tossup.
            </p>
            {/* Afterwards, when somebody asks what happened to their buzz: every
                buzz, clear, withdrawal and chat line, stamped and in order. */}
            <p className="klaxon-hint">
                <a
                    className="kc-export"
                    href={KlaxonApi.activityLogUrl(client.code, client.token)}
                    download
                    title="Buzz times, who cleared what, withdrawals, joins and chat — as a text file"
                >
                    Download the activity log
                </a>{" "}
                if you need to work out what happened to a buzz.
            </p>
        </>
    );

    // A shootout: twenty-odd people, each on their own, and a chat that is half
    // the point. The settings and the history go behind the header's buttons,
    // the players and the leaderboard become one list with the buzz queue lit
    // on it, and the chat takes whatever height is left — so a reader never
    // scrolls the panel to see who buzzed or what was said.
    if (state?.shootout != undefined) {
        const toggle = (which: "recent" | "settings"): void => setDrawer((d) => (d === which ? null : which));
        // An undo the big button doesn't offer (a clear that followed a
        // ruling) is only in the history: say there is one there.
        const historyUndo = undoable != undefined && undoable.kind !== "clear-accidental";
        return (
            <div className="klaxon-buzz klaxon-shootout" ref={shootoutRef}>
                <div className="ks-top">
                    <h2 className="klaxon-buzz-title">Buzzer</h2>
                    <button
                        className={"ks-icon" + (drawer === "recent" ? " on" : "") + (historyUndo ? " ks-dot" : "")}
                        aria-expanded={drawer === "recent"}
                        aria-label="Recent buzzes"
                        title={historyUndo ? "Recent buzzes — a clear can still be undone" : "Recent buzzes"}
                        onClick={() => toggle("recent")}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                            <path d="M3 3v5h5M12 7v5l3 2" />
                        </svg>
                    </button>
                    {soundButton}
                    <button
                        className={"ks-icon" + (drawer === "settings" ? " on" : "")}
                        aria-expanded={drawer === "settings"}
                        aria-label="Room settings"
                        title="Room settings — typed answers, listing, removing players, ending the game"
                        onClick={() => toggle("settings")}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
                        </svg>
                    </button>
                </div>

                {drawer === "recent" && <RecentBuzzes events={recent} onUndo={undoClear} drawer />}
                {drawer === "settings" && (
                    <div className="ks-drawer ks-settings">
                        <h3>Room settings</h3>
                        <label className="klaxon-opt ks-select" title="Only on this screen">
                            Chat sound
                            <select
                                value={chatSound}
                                onChange={(e) => {
                                    const mode = e.target.value as ChatSoundMode;
                                    setChatSound(mode);
                                    saveChatSound(mode);
                                    // Let them hear what they picked.
                                    if (mode === "all") playChatBlip();
                                    if (mode === "mentions") playMentionPing();
                                }}
                            >
                                <option value="mentions">When someone @mentions me</option>
                                <option value="all">Every message</option>
                                <option value="off">Off</option>
                            </select>
                        </label>
                        {typedOption}
                        {listedOption}
                        {staleRow}
                        {endRow}
                        {hints}
                    </div>
                )}
                {/* An ended game says so where it can't be missed. */}
                {state.ended != undefined && drawer !== "settings" && endRow}

                {stuckBanner}
                {phaseBar}
                {timerDisplay}
                <ProtestList client={client} protests={state.protests ?? []} />

                <div className={"klaxon-controls ks-controls" + (queueMode ? "" : " ks-two")}>
                    <button
                        onClick={() => client.resetBuzzer()}
                        disabled={!buzzed}
                        title="Accidental buzz (r) — clears without scoring, which records the buzz as accidental"
                    >
                        Accidental <kbd>r</kbd>
                    </button>
                    <button onClick={startTimer} title="5-second timer (t) — a countdown only you see">
                        5s timer <kbd>t</kbd>
                    </button>
                    {queueMode && (
                        <button onClick={() => client.nextBuzz()} disabled={!buzzed} title="Next buzzer">
                            Next →
                        </button>
                    )}
                    {queueMode && (
                        <button onClick={() => client.clearQueue()} disabled={!buzzed} title="Clear queue">
                            Clear
                        </button>
                    )}
                    {undoButton}
                    {showAnswerButton}
                </div>
                {notes}

                <Standings
                    players={players}
                    rows={state.shootout.rows}
                    packets={state.shootout.packets}
                    at={packetLabel(state.shootout.session)}
                    queue={queue}
                    label={modaqLabel}
                    picker={linkPicker}
                    onRemove={removePlayer}
                />

                <RoomChat
                    client={client}
                    initial={state.chat ?? []}
                    exportUrl={KlaxonApi.chatExportUrl(client.code, client.token)}
                    people={(state.members ?? [])
                        .filter((m) => m.id !== client.myId && m.role !== "spectator")
                        .map((m) => ({ id: m.id, name: m.displayName ?? m.rosterPlayer ?? m.name }))
                        .filter((p) => p.name !== "")}
                    chatSound={chatSound}
                />
            </div>
        );
    }

    return (
        <div className="klaxon-buzz">
            <h2 className="klaxon-buzz-title">
                Buzzer
                {soundButton}
            </h2>

            {stuckBanner}
            {phaseBar}
            {timerDisplay}

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
                            {index > 0 && (
                                <span className="qmargin" title={`Buzzed this far behind ${queue[0].name}`}>
                                    +{marginText(entry.marginMs)}
                                </span>
                            )}
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
                {undoButton}
                {showAnswerButton}
            </div>

            {notes}
            {typedOption}
            {listedOption}

            <div className="klaxon-players">
                <h3>
                    Players ({players.length}){offline > 0 && <span className="klaxon-offline"> · {offline} offline</span>}
                </h3>
                <ul>
                    {players.length === 0 && <li className="empty">No players connected.</li>}
                    {/* In the order they joined, and they stay put: someone
                        arriving goes at the bottom, and a connection that
                        flickers greys a row rather than moving it. Re-sorting
                        on every presence change made the list jump under the
                        reader while they were reading. */}
                    {players.map((player) => {
                        const label = modaqLabel(player, player.name + (player.team ? ` · ${player.team}` : ""));
                        return (
                            <li key={player.id} className={player.connected ? "" : "gone"}>
                                <span
                                    className={"klaxon-player-name" + (player.rosterPlayer ? " klaxon-linked" : "")}
                                    title={joinedAsTitle(player) ?? label}
                                >
                                    <span className="kp-label">{label}</span>
                                    {linkPicker(player, player.id)}
                                    {!player.connected && <span className="klaxon-offline">OFFLINE</span>}
                                    {player.connected && player.waiting && (
                                        <span
                                            className="klaxon-waiting"
                                            title={`On ${player.nextTeam ?? "another team"}, which isn't in this game: their buzzer is off until a New Game brings the team in.`}
                                        >
                                            NEXT GAME
                                        </span>
                                    )}
                                </span>
                                <button
                                    className="klaxon-remove"
                                    title={`Remove ${player.name} from the room`}
                                    aria-label={`Remove ${player.name} from the room`}
                                    onClick={() => removePlayer(player)}
                                >
                                    ×
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {staleRow}
            {endRow}
            {/* Below the controls a reader uses every question, and shut until
                wanted: it is for working out what happened, not for reading. */}
            <RecentBuzzes events={recent} onUndo={undoClear} />
            {hints}
        </div>
    );
}

/**
 * Each typed answer, under the tossup the moderator is reading, as it is
 * submitted: the moment a reader most needs to see it, and the place their
 * eyes already are. It arrives with a pop and a glow that fades, so a new one
 * can't slip in unnoticed between two words — on top of the answer's line in
 * the chat and the "Given:" line in the buzz panel, not instead of them.
 * Gone when the cycle is (the moderator ruled, or cleared the buzzer).
 */
export function SubmittedAnswers(props: {
    state: IPublicRoomState | undefined;
    client?: KlaxonClient;
}): JSX.Element | null {
    const { client } = props;
    // The answer box of the player with the floor, as they type it: the
    // moderator can see an answer forming (and a player sitting on one they
    // haven't sent) without waiting for Enter. The player is told their box
    // is being watched.
    const [live, setLive] = React.useState<IStaffAnswers | null>(client?.staffAnswers ?? null);
    React.useEffect(() => (client == undefined ? undefined : client.onStaffAnswers(setLive)), [client]);

    const said = props.state?.answers?.said ?? [];
    const members = props.state?.members ?? [];
    const nameOf = (id: string | null): string => {
        const m = id == null ? undefined : members.find((x) => x.id === id);
        return m?.rosterPlayer ?? m?.name ?? "Moderator";
    };
    // Who has the floor comes from the room; what they've typed from the staff
    // stream, and only when that stream is about the same player.
    const floor = props.state?.answers?.activePlayerId ?? null;
    const typed =
        floor == null || live?.activePlayerId !== floor
            ? ""
            : live.answers.find((a) => a.playerId === floor)?.text ?? "";
    // Once what's in the box is what they sent, the sent card says it.
    const lastSent = [...said].reverse().find((s) => s.playerId === floor)?.text;
    const showLive = floor != null && props.state?.answers != undefined && typed !== lastSent;

    if (said.length === 0 && !showLive) {
        return null;
    }
    return (
        <div className="kx-said-under" aria-live="polite">
            {showLive && (
                <div className="kx-said-card kx-typing-card">
                    <span className="kx-said-who">{nameOf(floor)} · typing</span>
                    <span className="kx-said-text">
                        {typed !== "" ? typed : <span className="kx-typing-empty">nothing yet</span>}
                        <span className="kx-caret" aria-hidden="true" />
                    </span>
                </div>
            )}
            {said.map((s, i) => (
                // Keyed by when it arrived, so only the new one animates.
                <div key={`${s.at}-${i}`} className={"kx-said-card" + (i === said.length - 1 ? " kx-said-latest" : "")}>
                    <span className="kx-said-who">{nameOf(s.playerId)}</span>
                    <span className="kx-said-text">{s.text}</span>
                </div>
            ))}
        </div>
    );
}
