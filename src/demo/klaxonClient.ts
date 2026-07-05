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
}

export interface IRoomSettings {
    queueMode?: boolean;
    allowWithdraw?: boolean;
    autoClear?: boolean;
    modaqMode?: boolean;
    modaqLite?: boolean;
}

export interface IPublicRoomState {
    code: string;
    name: string;
    tournamentCode: string | null;
    phase: "open" | "locked";
    cycleNo: number;
    settings: IRoomSettings;
    queue: IBuzzQueueEntry[];
    members: IRoomMember[];
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

export class KlaxonClient {
    public readonly code: string;
    public readonly token: string | null;
    public readonly role: string;
    private readonly playerId: string;
    private readonly name: string;
    private socket: KlaxonSocket | undefined;
    private readonly listeners: StateListener[] = [];
    public lastState: IPublicRoomState | undefined;

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

            const join = (): void => {
                socket.emit(
                    "join",
                    {
                        roomCode: this.code,
                        playerId: this.playerId,
                        name: this.name,
                        role: this.role,
                        staffToken: this.token,
                    },
                    (resp: { ok?: boolean; state?: IPublicRoomState; staffDenied?: boolean }) => {
                        if (!resp || !resp.ok) {
                            reject(new Error("Could not join room as moderator."));
                            return;
                        }
                        if (resp.staffDenied) {
                            reject(new Error("Staff token was rejected — reopen from your reader link."));
                            return;
                        }
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

    public resetBuzzer(): void {
        this.socket?.emit("reader_action", { action: "reset_buzzer" });
    }

    public nextBuzz(): void {
        this.socket?.emit("reader_action", { action: "next_buzz" });
    }

    public clearQueue(): void {
        this.socket?.emit("reader_action", { action: "clear_queue" });
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
    getAccess(tcode: string): Promise<{ required: boolean; status: string | null }> {
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
        inProgress = false
    ): Promise<{ filename: string }> {
        return rest("POST", `/api/rooms/${code}/export`, { token, round, qbj, inProgress });
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
}

export interface ITournamentInfo {
    code: string;
    name: string;
    schedule: { round: string; room: string; teams: string[] }[];
    rooms: string[];
    format?: ITournamentFormat;
}
