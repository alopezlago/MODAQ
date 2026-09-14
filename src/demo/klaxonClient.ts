// Klaxon integration glue for the MODAQ moderator page. This talks to the
// Klaxon server that hosts this bundle: the realtime buzzer over Socket.IO, and
// the MODAQ-artifact REST endpoints (roster, round packets, exported QBJ,
// errata). It is intentionally framework-free so moderator.tsx can wrap it in
// React state.

import { ITiebreakerItem } from "../contexts/TiebreakerContext";

// Socket.IO client is loaded globally by moderator.html (served by Klaxon).
declare const io: (opts?: unknown) => KlaxonSocket;

interface KlaxonSocket {
    on(event: string, cb: (...args: unknown[]) => void): void;
    emit(event: string, ...args: unknown[]): void;
}

export interface IBuzzQueueEntry {
    playerId: string;
    name: string;
    marginMs: number;
}

export interface IRoomMember {
    id: string;
    name: string;
    role: string;
    team: string | null;
    connected: boolean;
    // The MODAQ player this buzzer is linked to (set from the game's teams, or
    // by the reader), and that player's team. What buzzes are reported as.
    rosterTeam?: string | null;
    rosterPlayer?: string | null;
    displayName?: string;
    // A team the moderator put this buzzer on, the team it counts as being on
    // (roster link > moderator's call > what they typed), and whether they're
    // their team's captain for the pick/ban.
    assignedTeam?: string | null;
    effectiveTeam?: string | null;
    isCaptain?: boolean;
}

export interface IRoomSettings {
    queueMode?: boolean;
    allowWithdraw?: boolean;
    autoClear?: boolean;
    requireTeam?: boolean;
    playerAlerts?: boolean;
    modaqMode?: boolean;
    modaqLite?: boolean;
    shootout?: boolean;
    typedAnswers?: boolean;
    lockedAnswers?: boolean;
}

// One subcategory on a MASSINGER pick/ban board. `indexes` are 0-based tossup
// indexes into the round's packet; a ban removes the LAST remaining index (so
// a two-question subcategory keeps its earlier question until banned again).
export type MassingerControl = "moderator" | "captain" | "anyone";

export interface IMassingerSubcat {
    label: string;
    indexes: number[];
    protectedBy: number | null; // team index, or null
    banned: number; // how many of `indexes` are banned (from the end)
}

export interface IMassingerState {
    round: string;
    status: "active" | "done";
    teams: [string, string];
    turn: number; // team index currently picking (moderator-controlled)
    timerSec: number;
    target: number; // tossups that must remain (20 in MASSINGER)
    // Who may make a pick: the moderator alone, each team's captain, or anyone
    // the room knows to be on the team.
    control: MassingerControl;
    turnStartedAt?: number;
    deadline: number | null; // server ms; null = no timer / done
    subcats: IMassingerSubcat[];
    // `by` records who made the pick: a player's name, "moderator", or
    // "timeout" when the clock ran out and the server banned at random.
    actions: { type: "protect" | "ban"; label: string; team: number; at: number; by?: string }[];
}

export interface IPublicRoomState {
    code: string;
    name: string;
    tournamentCode: string | null;
    phase: "open" | "locked";
    cycleNo: number;
    settings: IRoomSettings;
    // Server time of the buzz still waiting on the moderator (null when clear).
    lastBuzzAt?: number | null;
    // MASSINGER pick/ban board (null outside the pick/ban phase).
    massinger?: IMassingerState | null;
    scoresheet?: unknown;
    // The room's buzzer roster: the teams playing here and their players (set
    // from the MODAQ game's teams), which is what buzzers are linked to.
    roster?: { name?: string; teamNames: string[]; teams: { name: string; players: string[] }[] } | null;
    queue: IBuzzQueueEntry[];
    members: IRoomMember[];
    // The typed-answer window for this cycle, when the room uses one. Nobody's
    // answer is in here — the moderator gets those on their own channel — only
    // whether a window is running and how many people have committed.
    answers?: {
        open?: boolean;
        guaranteed?: boolean;
        closesAt?: number;
        committed?: number;
        activePlayerId?: string | null;
        spoken?: string[];
    } | null;
    // Protests the teams lodged. The whole board is public to the room: under
    // the ACF rules the arguments are made in front of everyone.
    protests?: IProtest[];
    // A Discord shootout: everyone competing for themselves. Null otherwise.
    shootout?: {
        rows: { name: string; banked: number; current: number; total: number }[];
        packets?: number;
        // What the host set up; null until they have.
        session?: IShootoutSession | null;
    } | null;
    // The room's chat, which in a shootout is why half the people are there.
    chat?: IChatMessage[];
    // The host put this game on Klaxon's home page for anyone to join.
    listed?: boolean;
    // ...and/or called it over: players sent home, room closed to new ones.
    ended?: { at: number; by: string | null } | null;
}

export type WithdrawMode = "free" | "none" | "typed" | "rationed";

// A shootout's plan for the evening, as the host set it up (see the Klaxon
// server's shootout.normalizeSession). Names the packets; their contents are
// stored as the room's packets, under the packet id.
export interface IShootoutSession {
    name: string;
    notes: string;
    withdraw: WithdrawMode;
    // Questions a free withdrawal costs you before the next is free too
    // ("rationed" only).
    withdrawCooldown?: number;
    scoring: { scheme: string; bonuses: boolean };
    packets: { id: string; name: string; tossups: number; bonuses: number }[];
    current: string | null; // id of the packet being read
    currentIndex: number; // its place in `packets`, -1 before the first
}

// One line of the room's chat. Nothing to do with answering — see the Klaxon
// server's shootout.js.
type ChatListener = (message: IChatMessage) => void;
// Somebody in the room is (or has stopped) typing in the chat. Presence only:
// no text ever travels this way.
export interface IChatTyping {
    playerId: string;
    name: string;
    typing: boolean;
}
type ChatTypingListener = (typing: IChatTyping) => void;

export interface IChatMessage {
    id: string;
    playerId: string;
    name: string;
    staff: boolean;
    text: string;
    at: number;
    // Something the ROOM did rather than something somebody said — at present
    // "answer", an answer the room heard. Drawn as an event, never folded into
    // a run of chat.
    system?: string;
    // Who the message addressed, resolved by the server against the people in
    // the room — never taken from the sender, who could otherwise ping anyone.
    mentions?: { id: string; name: string }[];
}

// A protest raised by one of the teams. See the Klaxon server's protests.js for
// the rules (ACF gameplay H.2, H.3, H.5) these statuses follow.
export interface IProtest {
    id: string;
    cycle: number;
    round: string | null;
    at: number;
    byTeam: string;
    againstTeam: string | null;
    byName: string;
    reason: string | null;
    reasonLabel: string | null;
    rule: string | null;
    // "lodged" the team said they want to protest; "open" the moderator is
    // taking it and both teams are writing; "filed" it is in MODAQ.
    status: "lodged" | "open" | "filed" | "dismissed";
    questionShown: boolean;
    questionText: string | null;
    statements: { playerId: string; name: string; team: string | null; side: "for" | "against"; text: string; at: number }[];
}

// The Klaxon localStorage scheme (see public/js/util.js) prefixes every key with
// "bz_". These readers mirror it so the moderator page reuses the credentials
// the reader already established when they opened/created the room.
const bz = (key: string): string | null => localStorage.getItem("bz_" + key);

export function readCredentials(code: string): { token: string | null; role: string; playerId: string; name: string } {
    const staffRole = bz("staffRole:" + code) || bz("role:" + code) || "reader";
    const role = staffRole === "co-reader" ? "co-reader" : "reader";
    let stored = bz("playerId");
    if (stored == null) {
        const c = crypto as { randomUUID?: () => string };
        stored = c.randomUUID ? c.randomUUID() : String(Date.now());
        localStorage.setItem("bz_playerId", stored);
    }
    return {
        token: bz("staffToken:" + code),
        role,
        playerId: stored,
        name: bz("name") || "Moderator",
    };
}

type StateListener = (state: IPublicRoomState) => void;

// A message from the tournament director to this room's reader(s).
export interface IDirectorMessage {
    text: string;
    at: number;
}
type MessageListener = (message: IDirectorMessage) => void;

// A player in this room reporting that the buzzer was never cleared.
// The shared MODAQ game (see the server's modaq_state): the serialized game
// one moderator's MODAQ persisted, as the others should apply it.
export interface ISharedGame {
    seq: number;
    round: string;
    json: string | null;
    by?: string;
    at?: number;
}
type SharedGameListener = (s: ISharedGame) => void;

// A previous game of the room (see the server's modaq_archive): summary for
// the list, plus the serialized game when fetched individually.
export interface IArchivedGame {
    id: string;
    round: string;
    at: number;
    teams: string[];
    scores: number[];
    current: number;
    total: number;
    json?: string;
}

export interface IStuckAlert {
    playerId: string;
    name: string;
    team: string | null;
    at: number;
}
type StuckListener = (alert: IStuckAlert) => void;

export class KlaxonClient {
    public readonly code: string;
    public readonly token: string | null;
    public readonly role: string;
    private readonly playerId: string;
    private readonly name: string;
    private socket: KlaxonSocket | undefined;
    private readonly listeners: StateListener[] = [];
    private readonly messageListeners: MessageListener[] = [];
    private readonly stuckListeners: StuckListener[] = [];
    private readonly chatListeners: ChatListener[] = [];
    private readonly chatTypingListeners: ChatTypingListener[] = [];
    private readonly sharedGameListeners: SharedGameListener[] = [];
    private readonly buzzPendingListeners: ((wave: string) => void)[] = [];
    private joinedOnce = false;
    public lastState: IPublicRoomState | undefined;
    public messages: IDirectorMessage[] = [];

    constructor(code: string) {
        this.code = code.toUpperCase();
        const creds = readCredentials(this.code);
        this.token = creds.token;
        this.role = creds.role;
        this.playerId = creds.playerId;
        this.name = creds.name;
    }

    public connect(): Promise<IPublicRoomState> {
        return new Promise((resolve, reject) => {
            const socket = io({ transports: ["websocket", "polling"], reconnection: true });
            this.socket = socket;

            // Answer the server's RTT probes so it stays happy measuring us.
            const ackNow = (...args: unknown[]): void => {
                const ack = args[args.length - 1];
                if (typeof ack === "function") ack();
            };
            socket.on("srv_ping", ackNow);
            socket.on("rtt_echo", ackNow);

            socket.on("state", (...args: unknown[]) => {
                const s = args[0] as IPublicRoomState;
                this.lastState = s;
                for (const l of this.listeners) l(s);
            });

            socket.on("director_message", (...args: unknown[]) => {
                const m = args[0] as IDirectorMessage;
                if (!m || typeof m.text !== "string") return;
                // Buffer so a banner that mounts later (e.g. on the setup
                // screen) still gets messages that already arrived.
                this.messages = [...this.messages, m].slice(-5);
                for (const l of this.messageListeners) l(m);
            });

            socket.on("chat_message", (...args: unknown[]) => {
                const m = args[0] as IChatMessage;
                if (!m || typeof m.text !== "string") return;
                for (const l of this.chatListeners) l(m);
            });

            socket.on("chat_typing", (...args: unknown[]) => {
                const t = args[0] as IChatTyping;
                if (!t || typeof t.playerId !== "string") return;
                for (const l of this.chatTypingListeners) l(t);
            });

            socket.on("stuck_alert", (...args: unknown[]) => {
                const a = args[0] as IStuckAlert;
                if (!a || typeof a.playerId !== "string") return;
                for (const l of this.stuckListeners) l(a);
            });

            socket.on("buzz_pending", (...args: unknown[]) => {
                const p = args[0] as { cycleNo?: number; wave?: number };
                // A question has one wave per buzz-in, not one in total: the
                // key has to name the wave or every buzz after the first on a
                // question is taken for a repeat and goes unheard.
                for (const l of this.buzzPendingListeners) l(`${p?.cycleNo ?? -1}:${p?.wave ?? 0}`);
            });

            socket.on("modaq_state", (...args: unknown[]) => {
                const s = args[0] as ISharedGame;
                if (!s || typeof s.seq !== "number") return;
                for (const l of this.sharedGameListeners) l(s);
            });

            const join = (): void => {
                socket.emit(
                    "join",
                    {
                        roomCode: this.code,
                        playerId: this.playerId,
                        name: this.name,
                        role: this.role,
                        staffToken: this.token,
                        // An approved tournament moderator account authorizes as
                        // reader even without the room's staff token.
                        sessionToken: sessionToken() || undefined,
                    },
                    (resp: {
                        ok?: boolean;
                        state?: IPublicRoomState;
                        staffDenied?: boolean;
                        denyReason?: string;
                        error?: string;
                        modaqState?: { seq: number; round: string; hasGame: boolean } | null;
                    }) => {
                        if (!resp || !resp.ok) {
                            const message =
                                resp?.error === "no_room"
                                    ? "This room doesn't exist — it may have expired. Ask for a new link."
                                    : "Could not join room as moderator.";
                            reject(new Error(message));
                            return;
                        }
                        if (resp.staffDenied) {
                            const error = new Error(
                                "You don't have moderator access to this room."
                            ) as Error & { denyReason?: string; state?: IPublicRoomState };
                            error.denyReason = resp.denyReason;
                            error.state = resp.state;
                            reject(error);
                            return;
                        }
                        // A rejoin after a dropped connection may have missed the
                        // other moderator's changes: fetch the current shared game
                        // and let the listeners decide whether it's newer.
                        if (this.joinedOnce && resp.modaqState?.hasGame && this.sharedGameListeners.length > 0) {
                            this.refreshSharedGame();
                        }
                        this.joinedOnce = true;
                        if (resp.state) {
                            this.lastState = resp.state;
                            for (const l of this.listeners) l(resp.state);
                            resolve(resp.state);
                        }
                    }
                );
            };

            socket.on("connect", join);
        });
    }

    public onState(listener: StateListener): void {
        this.listeners.push(listener);
        if (this.lastState) listener(this.lastState);
    }

    // Returns a disposer so a React effect can unsubscribe cleanly. Messages
    // that arrived before subscribing are replayed (listeners dedupe).
    public onDirectorMessage(listener: MessageListener): () => void {
        this.messageListeners.push(listener);
        for (const m of this.messages) listener(m);
        return () => {
            const i = this.messageListeners.indexOf(listener);
            if (i >= 0) this.messageListeners.splice(i, 1);
        };
    }

    // "The buzzer isn't clear" pings from players. Transient (no replay): the
    // moderator only cares about a complaint that is still outstanding.
    public onStuckAlert(listener: StuckListener): () => void {
        this.stuckListeners.push(listener);
        return () => {
            const i = this.stuckListeners.indexOf(listener);
            if (i >= 0) this.stuckListeners.splice(i, 1);
        };
    }

    // A buzz just landed (before the reconcile window resolves who won it). The
    // listener is given a key for the WAVE it belongs to — see the handler.
    public onBuzzPending(listener: (wave: string) => void): () => void {
        this.buzzPendingListeners.push(listener);
        return () => {
            const i = this.buzzPendingListeners.indexOf(listener);
            if (i >= 0) this.buzzPendingListeners.splice(i, 1);
        };
    }

    // Changes to the shared MODAQ game made on another moderator's screen.
    public onSharedGame(listener: SharedGameListener): () => void {
        this.sharedGameListeners.push(listener);
        return () => {
            const i = this.sharedGameListeners.indexOf(listener);
            if (i >= 0) this.sharedGameListeners.splice(i, 1);
        };
    }

    // Push this screen's serialized game (null = we left the game). Resolves
    // with the sequence number the server minted for it.
    public pushSharedGame(round: string, json: string | null): Promise<{ ok?: boolean; seq?: number; error?: string }> {
        return this.massinger({ action: "modaq_state", round, json }) as Promise<{
            ok?: boolean;
            seq?: number;
            error?: string;
        }>;
    }

    // File the room's current shared game under previous games. Passing the id
    // of a game loaded from that list overwrites its entry instead of adding one.
    public archiveGame(id: string | null): Promise<{ ok?: boolean; id?: string; error?: string }> {
        return this.massinger({ action: "modaq_archive", id: id ?? undefined }) as Promise<{
            ok?: boolean;
            id?: string;
            error?: string;
        }>;
    }

    private refreshSharedGame(): void {
        KlaxonApi.getSharedGame(this.code, this.token)
            .then(({ state }) => {
                if (state) for (const l of this.sharedGameListeners) l(state);
            })
            .catch(() => {
                /* best-effort; the next change will bring us up to date */
            });
    }

    /**
     * Clear the buzzer. `judged` says the clear is the tail of a ruling — the
     * moderator scored the buzz in MODAQ. Without it the server records the
     * buzz as ACCIDENTAL: the moderator cleared without anyone answering, which
     * is a knocked buzzer, not a wrong answer. The two are indistinguishable
     * after the reset, so the difference has to travel with the clear.
     */
    public resetBuzzer(judged = false): void {
        this.socket?.emit("reader_action", { action: "reset_buzzer", judged });
    }

    public nextBuzz(): void {
        this.socket?.emit("reader_action", { action: "next_buzz" });
    }

    // Say something in the room's chat. Resolves with the server's ack so the
    // box can put a refused message back rather than swallowing it.
    public chatSay(text: string): Promise<{ ok?: boolean; error?: string }> {
        return new Promise((resolve) => {
            if (this.socket == undefined) {
                resolve({ error: "not_connected" });
                return;
            }
            this.socket.emit("chat_say", { text }, (res: { ok?: boolean; error?: string }) => resolve(res ?? {}));
        });
    }

    // Chat arrives on its own event so a line doesn't wait for the next state
    // broadcast, and doesn't cause one.
    public onChatMessage(listener: ChatListener): () => void {
        this.chatListeners.push(listener);
        return () => {
            const i = this.chatListeners.indexOf(listener);
            if (i >= 0) this.chatListeners.splice(i, 1);
        };
    }

    public onChatTyping(listener: ChatTypingListener): () => void {
        this.chatTypingListeners.push(listener);
        return () => {
            const i = this.chatTypingListeners.indexOf(listener);
            if (i >= 0) this.chatTypingListeners.splice(i, 1);
        };
    }

    public chatTyping(typing: boolean): void {
        this.socket?.emit("chat_typing", { typing });
    }

    public clearQueue(judged = false): void {
        this.socket?.emit("reader_action", { action: "clear_queue", judged });
    }

    // --- protests -----------------------------------------------------------
    // The moderator's side of a team's protest: take it (both teams may then
    // write), confirm it is filed in MODAQ, drop it, or show the room the
    // question it was about.
    public protest(action: string, id: string, extra: Record<string, unknown> = {}): Promise<{ ok?: boolean; error?: string }> {
        return new Promise((resolve) => {
            if (this.socket == undefined) {
                resolve({ error: "not_connected" });
                return;
            }
            this.socket.emit("reader_action", { action, id, ...extra }, (res: { ok?: boolean; error?: string }) =>
                resolve(res ?? {})
            );
        });
    }

    // MASSINGER pick/ban actions ride the staff-gated reader_action channel.
    // Resolves with the server's ack so the UI can surface rule violations.
    public massinger(payload: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }> {
        return new Promise((resolve) => {
            if (this.socket == undefined) {
                resolve({ error: "not_connected" });
                return;
            }
            this.socket.emit("reader_action", payload, (resp: { ok?: boolean; error?: string } | undefined) =>
                resolve(resp ?? {})
            );
        });
    }
}

// --- REST helpers ----------------------------------------------------------

async function rest<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        let message = res.statusText;
        try {
            const j = await res.json();
            message = j.error || message;
        } catch {
            /* ignore */
        }
        throw new Error(message);
    }
    const text = await res.text();
    try {
        return JSON.parse(text) as T;
    } catch {
        // Some endpoints return raw JSON text (packets/exports); hand it back as-is.
        return text as unknown as T;
    }
}

// The reader's optional account session, stored locally.
export const sessionToken = (): string | null =>
    typeof localStorage !== "undefined" ? localStorage.getItem("bz_sessionToken") : null;
const setSessionToken = (t: string): void => localStorage.setItem("bz_sessionToken", t);

// Gated reads carry both the room staff token and (when required) the account
// session, so a tournament that requires approved readers can enforce it.
const q = (token: string | null): string =>
    `token=${encodeURIComponent(token || "")}&sessionToken=${encodeURIComponent(sessionToken() || "")}`;

export const KlaxonApi = {
    getRoster(code: string, token: string | null): Promise<{ roster: string | null }> {
        return rest("GET", `/api/rooms/${code}/roster?${q(token)}`);
    },
    // Download URL for the room's full buzz log (every buzz attempt, ordered).
    fullBuzzUrl(code: string, token: string | null): string {
        return `/api/rooms/${code}/fullbuzz?${q(token)}`;
    },
    // A shootout's packets and games, laid out for quizbowlbuzzpoints.com.
    shootoutExportUrl(code: string, token: string | null): string {
        return `/api/rooms/${code}/shootout/export.zip?${q(token)}`;
    },
    // The room's chat as plain text, for the moderator to keep.
    chatExportUrl(code: string, token: string | null): string {
        return `/api/rooms/${code}/chat?${q(token)}`;
    },
    // Everything the room did, timestamped: buzzes, clears, withdrawals, chat.
    activityLogUrl(code: string, token: string | null): string {
        return `/api/rooms/${code}/log?${q(token)}`;
    },
    listGames(code: string, token: string | null): Promise<{ games: IArchivedGame[] }> {
        return rest("GET", `/api/rooms/${code}/games?${q(token)}`);
    },
    getGame(code: string, token: string | null, id: string): Promise<{ game: IArchivedGame & { json: string } }> {
        return rest("GET", `/api/rooms/${code}/games/${encodeURIComponent(id)}?${q(token)}`);
    },
    // The room's shared MODAQ game (null when no moderator has one open).
    getSharedGame(code: string, token: string | null): Promise<{ state: ISharedGame | null }> {
        return rest("GET", `/api/rooms/${code}/modaq-state?${q(token)}`);
    },
    listPackets(code: string, token: string | null): Promise<{ packets: string[] }> {
        return rest("GET", `/api/rooms/${code}/packets?${q(token)}`);
    },
    // The endpoint returns the packet JSON; rest() parses it, so this resolves to
    // the packet object (not a string).
    getPacket<T>(code: string, token: string | null, round: string): Promise<T> {
        return rest("GET", `/api/rooms/${code}/packets/${encodeURIComponent(round)}?${q(token)}`);
    },
    // --- accounts ---
    register(username: string, password: string): Promise<{ sessionToken: string; account: { id: string; username: string } }> {
        return rest<{ sessionToken: string; account: { id: string; username: string } }>(
            "POST", "/api/accounts/register", { username, password }
        ).then((r) => { if (r.sessionToken) setSessionToken(r.sessionToken); return r; });
    },
    login(username: string, password: string): Promise<{ sessionToken: string; account: { id: string; username: string } }> {
        return rest<{ sessionToken: string; account: { id: string; username: string } }>(
            "POST", "/api/accounts/login", { username, password }
        ).then((r) => { if (r.sessionToken) setSessionToken(r.sessionToken); return r; });
    },
    me(): Promise<{ account: { id: string; username: string } }> {
        return rest("GET", `/api/accounts/me?sessionToken=${encodeURIComponent(sessionToken() || "")}`);
    },
    getAccess(tcode: string): Promise<{ required: boolean; status: string | null; memberStatus?: string | null }> {
        return rest("GET", `/api/tournaments/${tcode}/access?sessionToken=${encodeURIComponent(sessionToken() || "")}`);
    },
    requestAccess(tcode: string): Promise<{ status: string }> {
        return rest("POST", `/api/tournaments/${tcode}/access`, { sessionToken: sessionToken() });
    },
    savePacket(code: string, token: string | null, round: string, packet: unknown): Promise<{ round: string }> {
        return rest("POST", `/api/rooms/${code}/packets`, { token, round, packet });
    },
    saveExport(
        code: string,
        token: string | null,
        round: string,
        qbj: unknown,
        inProgress = false,
        currentQuestion?: number
    ): Promise<{ filename: string }> {
        return rest("POST", `/api/rooms/${code}/export`, { token, round, qbj, inProgress, currentQuestion });
    },
    getTiebreakers(code: string, token: string | null): Promise<{ tiebreakers: ITiebreakerItem[] }> {
        return rest("GET", `/api/rooms/${code}/tiebreakers?${q(token)}`);
    },
    tiebreakerUsed(
        code: string,
        token: string | null,
        body: { tbRound: string; questionNumber: number; gameRound: string; teams: string[] }
    ): Promise<{ ok: boolean }> {
        return rest("POST", `/api/rooms/${code}/tiebreaker-used`, { token, ...body });
    },
    getErrata(code: string, token: string | null): Promise<{ errata: IServerErratum[] }> {
        return rest("GET", `/api/rooms/${code}/errata?${q(token)}`);
    },
    putErrata(
        code: string,
        token: string | null,
        round: string,
        entries: IServerErratum[]
    ): Promise<{ errata: IServerErratum[] }> {
        return rest("PUT", `/api/rooms/${code}/errata`, { token, round, entries });
    },
    getTournament(tcode: string): Promise<ITournamentInfo> {
        return rest("GET", `/api/tournaments/${tcode}`);
    },
    // The persisted pick/ban board for a round (massinger: null when none).
    getMassinger(code: string, token: string | null, round: string): Promise<{ massinger: IMassingerState | null }> {
        return rest("GET", `/api/rooms/${code}/massinger/${encodeURIComponent(round)}?${q(token)}`);
    },
};

export interface IServerErratum {
    room?: string;
    round?: string;
    questionNumber: number;
    questionType: "tossup" | "bonus";
    thrownOut: boolean;
    text: string;
    at?: number;
}

export interface ITournamentFormat {
    hasBonuses: boolean;
    tossupScheme: string; // "15/10/-5" | "20/15/10/-5" | "20/10/0"
    // MASSINGER pick/ban before each game (subcategory protect/ban to 20).
    massinger?: boolean;
    massingerTimerSec?: number;
    massingerControl?: MassingerControl;
}

export interface ITournamentInfo {
    code: string;
    name: string;
    schedule: { round: string; room: string; teams: string[] }[];
    rooms: string[];
    format?: ITournamentFormat;
}
