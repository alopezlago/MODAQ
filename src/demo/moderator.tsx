import * as React from "react";
import * as ReactDOM from "react-dom";
import { initializeIcons } from "@fluentui/react";

import "./moderator.css";
import { IGameUpdateProtest, IHostNewGame, IHostTeam, ILiveTeam, ModaqControl } from "../components/ModaqControl";
import { PACKET_ACCEPT, readPacketFile, packetName as fileStem } from "./packetFile";
import { PacketDrop } from "./PacketDrop";
import { IPacket } from "../state/IPacket";
import { IPlayer } from "../state/TeamState";
import { IErratum } from "../state/IErratum";
import { ITiebreakerItem } from "../contexts/TiebreakerContext";
import { IGameFormat } from "../state/IGameFormat";
import * as GameFormats from "../state/GameFormats";
import { ICustomExport } from "../state/CustomExport";
import { IMatch } from "../qbj/QBJ";
import * as QBJ from "../qbj/QBJ";
import { IStatus } from "../IStatus";
import { BuzzPanel } from "./BuzzPanel";
import {
    IDirectorMessage,
    IMassingerState,
    IRoomMember,
    MassingerControl,
    IPublicRoomState,
    IServerErratum,
    ITournamentFormat,
    ITournamentInfo,
    KlaxonApi,
    IArchivedGame,
    IShootoutSession,
    KlaxonClient,
    WithdrawMode,
    readCredentials,
    sessionToken,
} from "./klaxonClient";

// Map a tournament's scoring format to a MODAQ game format.
function gameFormatFor(format: ITournamentFormat | undefined): IGameFormat | undefined {
    if (format == undefined) {
        return undefined;
    }
    let powers: { marker: string; points: number }[];
    let negValue: number;
    switch (format.tossupScheme) {
        case "20/10/0":
            powers = [{ marker: "(*)", points: 20 }];
            negValue = 0;
            break;
        case "20/15/10/-5":
            powers = [
                { marker: "(+)", points: 20 },
                { marker: "(*)", points: 15 },
            ];
            negValue = -5;
            break;
        case "15/10/-5":
        default:
            powers = [{ marker: "(*)", points: 15 }];
            negValue = -5;
            break;
    }
    return {
        ...GameFormats.ACFGameFormat,
        powers,
        negValue,
        // A tournament without bonuses reads tossups only, so no bonus belongs on screen
        tossupsOnly: !format.hasBonuses,
        displayName: format.tossupScheme + (format.hasBonuses ? "" : " (no bonuses)"),
    };
}

// Filled in by vite (see vite.moderator.config.ts).
declare const __BUILD_VERSION__: string;

initializeIcons();

const code: string = (new URLSearchParams(location.search).get("room") || "").toUpperCase();

export interface IGameTeam {
    name: string;
    players: string[];
}

interface IReadingConfig {
    packet: IPacket;
    // Roster player pool passed to MODAQ's New Game dialog (its "From QBJ
    // Registration" tab); teams and player order are chosen there natively.
    rosters: IPlayer[];
    // In MASSINGER the teams were already chosen (before the pick/ban), so the
    // final dialog is prefilled with them and shows the pick/ban result.
    teams?: IGameTeam[];
    board?: IMassingerState;
    onEditPickBan?: () => void;
    round: string;
    errata: IErratum[];
    tiebreakers: ITiebreakerItem[];
    gameFormat: IGameFormat | undefined;
}

// Distinct team names in a roster pool (for the "N teams" hint).
function teamsFromRoster(players: IPlayer[]): string[] {
    const seen: string[] = [];
    for (const player of players) {
        if (player.teamName && seen.indexOf(player.teamName) < 0) {
            seen.push(player.teamName);
        }
    }
    return seen;
}

// --- MASSINGER pick/ban helpers -------------------------------------------

const MASSINGER_TARGET = 20;

// The subcategory of a tossup comes from its packet metadata, e.g.
// "<Amogh Kulkarni, History - European>" or "Science - Biology": strip the
// angle brackets and take the last comma-separated segment.
function subcatOf(metadata: string | undefined): string {
    let text = (metadata || "").trim().replace(/^</, "").replace(/>$/, "").trim();
    const parts = text.split(",");
    text = parts[parts.length - 1].trim();
    return text || "Uncategorized";
}

// Group the packet's tossups by subcategory, in packet order.
function deriveSubcats(packet: IPacket): { label: string; indexes: number[] }[] {
    const byLabel = new Map<string, number[]>();
    packet.tossups.forEach((tossup, index) => {
        const label = subcatOf(tossup.metadata);
        const list = byLabel.get(label);
        if (list) {
            list.push(index);
        } else {
            byLabel.set(label, [index]);
        }
    });
    return Array.from(byLabel.entries()).map(([label, indexes]) => ({ label, indexes }));
}

// True when this game should run the pick/ban phase: the tournament format
// asks for it, the packet is tagged with (multiple) subcategories, and there
// is actually something to ban.
function massingerApplies(format: ITournamentFormat | undefined, packet: IPacket): boolean {
    return format?.massinger === true && packet.tossups.length > MASSINGER_TARGET && deriveSubcats(packet).length >= 2;
}

// Apply a finished (or partial) board to the packet: each subcategory loses
// its LAST `banned` questions. Bonuses are filtered in lockstep only when they
// pair 1:1 with tossups; a custom readingOrder can't survive index changes, so
// it is dropped (per the YAPP2 spec, discard the whole field).
function applyMassinger(packet: IPacket, board: IMassingerState): IPacket {
    const removed = new Set<number>();
    for (const subcat of board.subcats) {
        for (let i = 0; i < subcat.banned; i++) {
            removed.add(subcat.indexes[subcat.indexes.length - 1 - i]);
        }
    }
    const filtered: IPacket = {
        ...packet,
        tossups: packet.tossups.filter((_, index) => !removed.has(index)),
    };
    if (packet.bonuses && packet.bonuses.length === packet.tossups.length) {
        filtered.bonuses = packet.bonuses.filter((_, index) => !removed.has(index));
    }
    if (filtered.readingOrder) {
        delete filtered.readingOrder;
    }
    return filtered;
}

const massingerRemaining = (board: IMassingerState): number =>
    board.subcats.reduce((sum, subcat) => sum + (subcat.indexes.length - subcat.banned), 0);

// The teams (and their players, in order) out of a match QBJ — this is how the
// teams the moderator entered in MODAQ's New Game dialog reach Klaxon, both to
// seed the pick/ban and to link every buzzer to a real player.
function teamsFromMatch(match: IMatch): IGameTeam[] {
    return (match.match_teams ?? []).map((matchTeam) => ({
        name: matchTeam.team?.name ?? "",
        players: (matchTeam.match_players ?? [])
            .map((matchPlayer) => matchPlayer.player?.name ?? "")
            .filter((name) => name !== ""),
    }));
}

const teamsKey = (teams: IGameTeam[]): string => teams.map((t) => `${t.name}:${t.players.join("|")}`).join("/");

// Push the game to Klaxon on every change: the teams (so buzzes are attributed
// to MODAQ players — sent only when they actually change) and the match itself,
// which the server cuts down to the player-safe scoresheet the room shows.
// Called in every mode.
function useGameSync(
    client: KlaxonClient
): (
    match: IMatch,
    inProgress?: boolean,
    currentQuestion?: number,
    hasBonuses?: boolean,
    protests?: IGameUpdateProtest[],
    categories?: string[],
    answers?: string[],
    questions?: string[]
) => void {
    const lastKey = React.useRef<string>("");
    const hadEvents = React.useRef<boolean>(false);
    return React.useCallback(
        (
            match: IMatch,
            _inProgress?: boolean,
            currentQuestion?: number,
            hasBonuses?: boolean,
            protests?: IGameUpdateProtest[],
            categories?: string[],
            answers?: string[],
            questions?: string[]
        ) => {
            client.massinger({
                action: "modaq_game",
                qbj: match,
                currentQuestion,
                hasBonuses: hasBonuses !== false,
                protests: protests ?? [],
                // The whole packet's categories, in packet order. The server
                // alone decides which of them a player may see: it releases a
                // category only once the room has finished that cycle.
                categories: categories ?? [],
                // The packet's answer lines, for a playtest room. Same rule as
                // categories: the server decides who may see one, and only
                // after the room has finished that cycle.
                answers: answers ?? [],
                // The questions themselves. Same rule again: the server decides
                // who sees one, and how far behind the room it runs.
                questions: questions ?? [],
            });
            // A game with no events after one that had some is a new game, not
            // an edit of the loaded one: stop overwriting that archive.
            const events = (match.match_questions ?? []).reduce((n, q) => n + (q.buzzes?.length ?? 0), 0);
            if (events === 0 && hadEvents.current) {
                writeGameId(client.code, null);
            }
            hadEvents.current = events > 0;
            const teams = teamsFromMatch(match).filter((t) => t.name !== "" && t.players.length > 0);
            if (teams.length < 2) {
                return;
            }
            const key = teamsKey(teams);
            if (key === lastKey.current) {
                return;
            }
            lastKey.current = key;
            client.massinger({ action: "set_modaq_teams", teams });
        },
        [client]
    );
}

// The MODAQ player behind the buzz the room is waiting on: the head of the
// latency-fair queue, once it's linked to a player in the game. Undefined until
// the buzz resolves, so nothing is ever shown before the server has decided.
function useBuzzedInPlayer(roomState: IPublicRoomState | undefined): { name: string; teamName: string } | undefined {
    const head = roomState?.queue?.[0];
    const member = head ? (roomState?.members ?? []).find((m) => m.id === head.playerId) : undefined;
    const name = member?.rosterPlayer ?? "";
    const teamName = member?.rosterTeam ?? "";
    return React.useMemo(() => (name === "" ? undefined : { name, teamName }), [name, teamName]);
}

// Judging a buzz resolves it: clear the Klaxon buzzer, or — a wrong answer in
// queue mode — hand the buzzer to whoever is next in the queue.
function useJudgedHandler(client: KlaxonClient, roomState: IPublicRoomState | undefined): (correct: boolean) => void {
    const queueMode = roomState?.settings?.queueMode === true;
    return React.useCallback(
        (correct: boolean) => {
            if (!correct && queueMode) {
                client.nextBuzz();
            } else {
                // Judged: the buzz was scored, so this clear is NOT the
                // moderator declaring an accidental buzz (see resetBuzzer).
                client.resetBuzzer(true);
            }
        },
        [client, queueMode]
    );
}

// --- Shared game -------------------------------------------------------------
// MODAQ persists its whole game to localStorage; Klaxon keeps a copy of that
// snapshot per room. Every moderator screen pushes its snapshot on each change
// and applies the others' as they arrive, so a reload on any device resumes
// at the same question with the same scores, and a co-reader can score the
// same game. Last write wins at whole-game granularity — fine for a reader
// and a scorekeeper who aren't clicking the same thing in the same second.
const sharedSeqKey = (code: string): string => "bz_modaqSeq:" + code;
const readSharedSeq = (code: string): number => Number(localStorage.getItem(sharedSeqKey(code))) || 0;
const writeSharedSeq = (code: string, seq: number): void => {
    try {
        localStorage.setItem(sharedSeqKey(code), String(seq));
    } catch {
        /* ignore */
    }
};

// Before MODAQ mounts: if the server's copy of the game is newer than what
// this device saw last, write it into the localStorage store MODAQ will read.
// Returns the round the shared game is for (undefined when there is none).
async function seedSharedGame(
    client: KlaxonClient,
    storeNameFor: (round: string) => string
): Promise<{ round: string } | undefined> {
    try {
        const { state } = await KlaxonApi.getSharedGame(client.code, client.token);
        if (!state || !state.json) {
            return undefined;
        }
        if (state.seq > readSharedSeq(client.code)) {
            localStorage.setItem(storeNameFor(state.round), state.json);
            writeSharedSeq(client.code, state.seq);
        }
        return { round: state.round };
    } catch {
        return undefined;
    }
}

function useSharedGame(
    client: KlaxonClient,
    round: string
): {
    remoteState: { json: string; seq: number } | undefined;
    onPersistedState: (json: string) => void;
} {
    const [remoteState, setRemoteState] = React.useState<{ json: string; seq: number } | undefined>(undefined);
    const seqRef = React.useRef<number>(readSharedSeq(client.code));
    const lastJsonRef = React.useRef<string | undefined>(undefined);

    React.useEffect(
        () =>
            client.onSharedGame((s) => {
                if (s.seq <= seqRef.current) {
                    return; // older than (or the same as) what we have
                }
                seqRef.current = s.seq;
                writeSharedSeq(client.code, s.seq);
                if (s.json == null) {
                    return; // the other moderator left the game; ours stays open
                }
                if (s.round !== round) {
                    // They moved on to another round: follow them (the boot
                    // path seeds the new game and resumes into it).
                    location.reload();
                    return;
                }
                lastJsonRef.current = s.json;
                setRemoteState({ json: s.json, seq: s.seq });
            }),
        [client, round]
    );

    const onPersistedState = React.useCallback(
        (json: string) => {
            if (json === lastJsonRef.current) {
                return;
            }
            lastJsonRef.current = json;
            client.pushSharedGame(round, json).then((r) => {
                if (typeof r.seq === "number" && r.seq > seqRef.current) {
                    seqRef.current = r.seq;
                    writeSharedSeq(client.code, r.seq);
                }
            });
        },
        [client, round]
    );

    return { remoteState, onPersistedState };
}

// --- Previous games ----------------------------------------------------------
// Outside a tournament there is no director keeping the exports, so the room
// itself remembers the games read in it. Leaving a game (End game, Change
// round, loading another) files the shared snapshot; loading one puts it back
// into MODAQ to fix a score or re-export. The id of a loaded game is kept so
// filing it again overwrites its entry rather than adding a duplicate; a new
// game (no events yet, after one that had some) drops the id.
const gameIdKey = (code: string): string => "bz_modaqGameId:" + code;
const readGameId = (code: string): string | null => localStorage.getItem(gameIdKey(code));
const writeGameId = (code: string, id: string | null): void => {
    try {
        if (id == null) {
            localStorage.removeItem(gameIdKey(code));
        } else {
            localStorage.setItem(gameIdKey(code), id);
        }
    } catch {
        /* ignore */
    }
};

async function archiveCurrentGame(client: KlaxonClient): Promise<void> {
    try {
        await client.archiveGame(readGameId(client.code));
    } catch {
        /* best-effort */
    }
    writeGameId(client.code, null);
}

// Fetch a previous game and stage it for MODAQ: its snapshot goes into the
// localStorage store MODAQ reads on mount, and becomes the room's shared game
// so a co-reader (or a reload) picks it up too.
async function stagePreviousGame(
    client: KlaxonClient,
    id: string,
    storeNameFor: (round: string) => string
): Promise<IArchivedGame & { json: string }> {
    const { game } = await KlaxonApi.getGame(client.code, client.token, id);
    localStorage.setItem(storeNameFor(game.round), game.json);
    writeGameId(client.code, game.id);
    const r = await client.pushSharedGame(game.round, game.json);
    if (typeof r.seq === "number") {
        writeSharedSeq(client.code, r.seq);
    }
    return game;
}

function describeGame(g: IArchivedGame): string {
    // However many sides the game had: two reads as "A 120 – B 95", and a
    // three-way or a shootout lists them all rather than giving up.
    const teams =
        g.teams.length > 0 ? g.teams.map((name, i) => `${name} ${g.scores[i] ?? 0}`).join(" – ") : "(teams not set)";
    const progress = g.total > 0 ? ` · Q${Math.min(g.current, g.total)}/${g.total}` : "";
    return `${teams}${progress}`;
}

function PreviousGames(props: {
    client: KlaxonClient;
    showRound: boolean;
    showWhenEmpty?: boolean;
    onLoad: (game: IArchivedGame) => Promise<void>;
}): JSX.Element | null {
    const { client, showRound, showWhenEmpty, onLoad } = props;
    const [games, setGames] = React.useState<IArchivedGame[]>([]);
    const [loaded, setLoaded] = React.useState(false);
    const [busy, setBusy] = React.useState<string | null>(null);
    const [msg, setMsg] = React.useState("");
    React.useEffect(() => {
        KlaxonApi.listGames(client.code, client.token)
            .then((r) => setGames(r.games))
            .catch(() => setGames([]))
            .finally(() => setLoaded(true));
    }, [client]);
    if (games.length === 0) {
        // On the setup screen an empty list is just noise; when the moderator
        // asked for the panel it has to answer them.
        if (!showWhenEmpty) {
            return null;
        }
        return (
            <div className="mod-prev">
                <h3>Previous games in this room</h3>
                <p className="hint">
                    {loaded
                        ? "No games finished in this room yet. A game is filed here when you export it, change round, or end it."
                        : "Loading…"}
                </p>
            </div>
        );
    }
    return (
        <div className="mod-prev">
            <h3>Previous games in this room</h3>
            <ul>
                {games.map((g) => (
                    <li key={g.id}>
                        <span className="mod-prev-label">
                            {showRound && g.round !== "lite" ? `Round ${g.round} · ` : ""}
                            {describeGame(g)}
                            <span className="mod-prev-when"> · {new Date(g.at).toLocaleString()}</span>
                        </span>
                        <button
                            disabled={busy != null}
                            onClick={async () => {
                                setBusy(g.id);
                                setMsg("");
                                try {
                                    await onLoad(g);
                                } catch (error) {
                                    setMsg((error as Error).message);
                                } finally {
                                    setBusy(null);
                                }
                            }}
                        >
                            {busy === g.id ? "Loading…" : "Load"}
                        </button>
                    </li>
                ))}
            </ul>
            <p className="hint">
                Load a game to correct a score or export it again; it becomes the room&apos;s current game.
            </p>
            {msg && <p className="msg">{msg}</p>}
        </div>
    );
}

// Exporting a game also hands the moderator the room's full buzz log
// (*_full_buzz.json: every buzz attempt, late ones included, with question
// numbers) alongside the match JSON, for buzz-point tracking.
function downloadFullBuzz(client: KlaxonClient): void {
    try {
        const a = document.createElement("a");
        a.href = KlaxonApi.fullBuzzUrl(client.code, client.token);
        a.download = `klaxon_${client.code}_full_buzz.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch {
        /* best-effort */
    }
}

// After the game is exported, "End game" hands the room back to the plain
// Klaxon reader view (settings, players, invite links): MODAQ mode is turned
// off for the room, and the shared game and the players' scoresheet are
// retired with it. Re-entering MODAQ later is one click on that page.
function useEndGame(
    client: KlaxonClient,
    round: string
): { exported: boolean; onExported: () => void; endGame: () => void } {
    const [exported, setExported] = React.useState(false);
    const onExported = React.useCallback(() => setExported(true), []);
    const endGame = React.useCallback(() => {
        if (
            !window.confirm(
                "End this game and go back to the buzzer page? The room leaves MODAQ mode; you can start MODAQ again from there."
            )
        ) {
            return;
        }
        try {
            localStorage.removeItem("bz_modaqLive:" + client.code);
        } catch {
            /* ignore */
        }
        archiveCurrentGame(client)
            .then(() => {
                client.massinger({ action: "modaq_game", qbj: null });
                client.pushSharedGame(round, null);
                return client.massinger({ action: "set_options", options: { modaqMode: false, modaqLite: false } });
            })
            .then(() => {
                location.href = `/r/${client.code}`;
            });
    }, [client, round]);
    return { exported, onExported, endGame };
}

// MODAQ's New Game dialog only shows its packet file picker when a parse
// service is configured (JSON packets are parsed in the browser; only .docx
// files go to the service). This is Klaxon's own route, which proxies to the
// YAPP instance Klaxon deploys (see /api/yapp/parse in server/index.js) — so a
// moderator loading a .docx stays on one origin and gets our parser, not a
// third party's. Relative on purpose: it follows whatever host serves this page.
const YAPP_SERVICE_URL = "/api/yapp/parse?modaq=true";

// Shown under MODAQ's packet picker in LITE mode only. A lite reader brings
// their own packet file, so the converter is worth pointing at right where
// they go looking for one; in tournament mode the packet comes from the
// director instead, and the link would just be noise. Module-level so its
// identity is stable across renders (ModaqControl diffs the prop by reference).
const PACKET_PARSER_LINK = {
    text: "Only have a Word packet? Convert it with Klaxon's packet parser",
    url: "/yapp",
};

function serverErratumToErratum(e: IServerErratum): IErratum {
    return {
        questionNumber: e.questionNumber,
        questionType: e.questionType,
        thrownOut: e.thrownOut,
        text: e.text,
        at: e.at,
    };
}

// --- theme -----------------------------------------------------------------------
// Klaxon's theme (dark or light) lives in /js/theme.js, shared by every Klaxon
// page: it stamps html[data-theme] and announces changes with a `klaxon-theme`
// event, including a change made in another tab. This page follows it, and so
// does MODAQ — turning on MODAQ's own Dark mode option sets Klaxon's theme, so
// the two never disagree.
interface IKlaxonThemeApi {
    get(): "dark" | "light";
    set(pref: "dark" | "light" | "system"): void;
}
const klaxonTheme = (): IKlaxonThemeApi | undefined =>
    ((window as unknown) as { klaxonTheme?: IKlaxonThemeApi }).klaxonTheme;
const currentTheme = (): "dark" | "light" =>
    klaxonTheme()?.get() ?? (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function useKlaxonDark(): [boolean, (dark: boolean) => void] {
    const [dark, setDark] = React.useState(() => currentTheme() === "dark");
    React.useEffect(() => {
        const follow = (): void => setDark(currentTheme() === "dark");
        document.addEventListener("klaxon-theme", follow);
        follow();
        return () => document.removeEventListener("klaxon-theme", follow);
    }, []);
    const choose = React.useCallback((next: boolean) => {
        const api = klaxonTheme();
        if (api) {
            api.set(next ? "dark" : "light");
        } else {
            setDark(next);
        }
    }, []);
    return [dark, choose];
}

// MODAQ, in the page's theme.
function KlaxonModaq(props: React.ComponentProps<typeof ModaqControl>): JSX.Element {
    const [dark, setDark] = useKlaxonDark();
    return <ModaqControl {...props} darkMode={dark} onDarkModeChange={setDark} />;
}

function ThemeToggle(): JSX.Element {
    const [dark, setDark] = useKlaxonDark();
    const label = dark ? "Switch to light mode" : "Switch to dark mode";
    return (
        <button className="kx-theme" onClick={() => setDark(!dark)} aria-label={label} title={label}>
            {dark ? "☀" : "☾"}
        </button>
    );
}

// The Klaxon bar every page carries, so the moderator knows where they are and
// can get back to the room or start another game.
function KlaxonHeader(props: { code: string }): JSX.Element {
    const creds = readCredentials(props.code);
    return (
        <header className="kx-bar">
            <nav className="kx-crumbs" aria-label="Breadcrumb">
                <a className="kx-crumb kx-mark" href="/">
                    Klaxon
                </a>
                <span className="kx-sep">›</span>
                <a className="kx-crumb" href="/" title="Create or join another game">
                    New game
                </a>
                <span className="kx-sep">›</span>
                <span className="kx-code">{props.code}</span>
                <span className="kx-crumb" aria-current="page">
                    MODAQ reader
                </span>
            </nav>
            <div className="kx-right">
                <span className="kx-pill">{creds.role === "co-reader" ? "co-reader" : "reader"}</span>
                <ThemeToggle />
            </div>
        </header>
    );
}

function Moderator(): JSX.Element {
    return (
        <>
            <KlaxonHeader code={code} />
            <ModeratorBody />
        </>
    );
}

function ModeratorBody(): JSX.Element {
    const clientRef = React.useRef<KlaxonClient | undefined>(undefined);
    const [phase, setPhase] = React.useState<
        | "connecting"
        | "error"
        | "setup"
        | "lobby"
        | "pickban"
        | "reading"
        | "lite"
        | "account"
        | "shootout-setup"
        | "shootout"
    >("connecting");
    const [fatal, setFatal] = React.useState<string>("");
    // When the fix for an error is signing in, the error view offers the link.
    const [signInUrl, setSignInUrl] = React.useState<string | null>(null);
    // The account phase gates on actual tournament MEMBERSHIP (not just packet
    // access) when the socket join itself was denied for a missing approval.
    const [needsMembership, setNeedsMembership] = React.useState(false);
    const [roomState, setRoomState] = React.useState<IPublicRoomState | undefined>(undefined);

    // Setup inputs
    const [rosterPlayers, setRosterPlayers] = React.useState<IPlayer[]>([]);
    const [centralRoster, setCentralRoster] = React.useState(false); // roster came from the tournament
    const [serverPackets, setServerPackets] = React.useState<string[]>([]);
    const [tournament, setTournament] = React.useState<ITournamentInfo | undefined>(undefined);
    const [tournamentFormat, setTournamentFormat] = React.useState<ITournamentFormat | undefined>(undefined);
    const [round, setRound] = React.useState<string>("1");
    const [packetFile, setPacketFile] = React.useState<File | undefined>(undefined);
    const [setupMsg, setSetupMsg] = React.useState<string>("");
    const [starting, setStarting] = React.useState<boolean>(false);

    const [config, setConfig] = React.useState<IReadingConfig | undefined>(undefined);

    // MASSINGER: the loaded-but-not-yet-filtered packet, and the teams chosen in
    // MODAQ's New Game dialog before the pick/ban starts.
    const [pickban, setPickban] = React.useState<
        { round: string; packet: IPacket; rosters: IPlayer[]; teams?: IGameTeam[] } | undefined
    >(undefined);

    // Connect + bootstrap once.
    React.useEffect(() => {
        if (!code) {
            setFatal("No room specified. Open this page from your reader link.");
            setPhase("error");
            return;
        }
        const client = new KlaxonClient(code);
        clientRef.current = client;
        // Two ways in: the room's reader link (staff token), or a logged-in
        // account the director approved for this tournament.
        if (!client.token && !sessionToken()) {
            setFatal(
                "You don't have a reader link for this room on this device. " +
                    "Sign in with your reader account (if the director added you as a moderator), or open the room from your reader link."
            );
            setSignInUrl(`/account?return=${encodeURIComponent(`/modaq?room=${code}`)}`);
            setPhase("error");
            return;
        }

        client.onState((state) => setRoomState(state));
        client
            .connect()
            .then(async (state) => {
                setRoomState(state);
                // Lite MODAQ mode skips all tournament infrastructure: no roster,
                // round packets, server export, or errata. The moderator just
                // gets MODAQ (with its own New Game / packet loader / export) next
                // to the Klaxon buzzer.
                if (state.settings?.modaqLite) {
                    await seedSharedGame(client, () => `klaxon-lite-${code}`);
                    // A shootout starts with the host's setup (packets, notes,
                    // withdraw rule) and goes straight back to reading after it.
                    if (state.settings?.shootout) {
                        setPhase((state.shootout?.session?.packets.length ?? 0) > 0 ? "shootout" : "shootout-setup");
                        return;
                    }
                    setPhase("lite");
                    return;
                }
                // Gate on account approval BEFORE fetching centralized artifacts,
                // so an unapproved reader doesn't trigger 403s.
                if ((await decideStartPhase(state.tournamentCode)) === "account") {
                    setPhase("account");
                    return;
                }
                const boot = await bootstrap(client, state);
                // A reload mid-game goes straight back into the round being
                // read — no re-picking the round, roster, or packet.
                if (await tryResume(client, boot)) {
                    return;
                }
                setPhase("setup");
            })
            .catch((error: Error & { denyReason?: string; state?: IPublicRoomState }) => {
                if (error.denyReason === "not_logged_in") {
                    setFatal(
                        "Sign in with your reader account to moderate this room (the director must have added or approved you)."
                    );
                    setSignInUrl(`/account?return=${encodeURIComponent(`/modaq?room=${code}`)}`);
                } else if (error.denyReason === "not_approved" && error.state?.tournamentCode) {
                    // Known account, not approved yet: offer the request-access
                    // flow; approval needs a fresh join, so reload afterwards.
                    setRoomState(error.state);
                    setNeedsMembership(true);
                    setPhase("account");
                    return;
                } else if (error.denyReason === "not_approved") {
                    setFatal(
                        "Your account isn't approved for this tournament yet — ask the director to add you (they can use your email)."
                    );
                } else {
                    setFatal(error.message);
                }
                setPhase("error");
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    interface IBootstrapData {
        rosterList: IPlayer[];
        format: ITournamentFormat | undefined;
    }

    async function bootstrap(client: KlaxonClient, state: IPublicRoomState): Promise<IBootstrapData> {
        // Roster (default teams/players for this tournament).
        let rosterList: IPlayer[] = [];
        try {
            const { roster } = await KlaxonApi.getRoster(code, client.token);
            if (roster) {
                const parsed = QBJ.parseRegistration(roster);
                if (parsed.success) {
                    rosterList = parsed.value.map((p) => ({
                        name: p.name,
                        teamName: p.teamName,
                        isStarter: p.isStarter,
                    }));
                    setRosterPlayers(rosterList);
                    setCentralRoster(true);
                }
            }
        } catch {
            /* no roster is fine */
        }

        // Round packets already uploaded for this bucket.
        try {
            const { packets } = await KlaxonApi.listPackets(code, client.token);
            setServerPackets(packets);
        } catch {
            /* ignore */
        }

        // Tournament schedule, to prefill the round for this room. Teams are
        // chosen later in MODAQ's own New Game dialog.
        let format: ITournamentFormat | undefined = undefined;
        if (state.tournamentCode) {
            try {
                const info = await KlaxonApi.getTournament(state.tournamentCode);
                setTournament(info);
                setTournamentFormat(info.format);
                format = info.format;
                const row = info.schedule.find((r) => r.room === code);
                if (row) {
                    setRound(row.round);
                }
            } catch {
                /* ignore */
            }
        }
        return { rosterList, format };
    }

    // The Reading view keeps this marker pointing at the round while its live
    // sync says the game is still in progress (cleared once the game is final).
    // If it's set when the page loads, jump straight back into that round:
    // fetch its packet/errata/tiebreakers from the server and let MODAQ's
    // persisted state restore the game at the exact question.
    async function tryResume(client: KlaxonClient, boot: IBootstrapData): Promise<boolean> {
        // The shared game (another device, or the other moderator) wins over
        // this device's own marker: it's the game the room is actually playing.
        const shared = await seedSharedGame(client, (r) => `klaxon-${code}-${r}`);
        if (shared) {
            try {
                localStorage.setItem("bz_modaqLive:" + code, shared.round);
            } catch {
                /* ignore */
            }
        }
        const liveRound = shared?.round || localStorage.getItem("bz_modaqLive:" + code);
        if (!liveRound) {
            return false;
        }
        try {
            let packet = await KlaxonApi.getPacket<IPacket>(code, client.token, liveRound);
            if (!Array.isArray(packet.tossups)) {
                return false;
            }
            // A MASSINGER game reads the pick/ban-filtered packet, so re-apply
            // the round's persisted board when there is one.
            try {
                const { massinger } = await KlaxonApi.getMassinger(code, client.token, liveRound);
                if (massinger && massinger.status === "done") {
                    packet = applyMassinger(packet, massinger);
                }
            } catch {
                /* no board (or fetch hiccup): read the full packet */
            }
            await enterReading(client, liveRound, packet, boot.rosterList, boot.format);
            return true;
        } catch {
            // Packet unavailable (or any other hiccup): fall back to setup.
            return false;
        }
    }

    // If the tournament requires approved reader accounts, gate on that before
    // the setup screen.
    async function decideStartPhase(tcode: string | null): Promise<"account" | "setup"> {
        if (!tcode) return "setup";
        try {
            const access = await KlaxonApi.getAccess(tcode);
            if (access.required && access.status !== "approved") return "account";
        } catch {
            /* if the check fails, fall through to setup; the server still gates reads */
        }
        return "setup";
    }

    const teams = teamsFromRoster(rosterPlayers);

    // Let the moderator bring their own roster (registration QBJ) — parsed
    // locally to feed MODAQ's New Game player pool, without touching the
    // tournament's director-managed roster.
    async function onRosterFile(file: File | undefined): Promise<void> {
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = QBJ.parseRegistration(text);
            if (!parsed.success) {
                setSetupMsg("Roster: " + parsed.message);
                return;
            }
            setRosterPlayers(parsed.value.map((p) => ({ name: p.name, teamName: p.teamName, isStarter: p.isStarter })));
            setSetupMsg("");
        } catch (error) {
            setSetupMsg("Couldn't read roster: " + (error as Error).message);
        }
    }

    async function loadPacketForStart(client: KlaxonClient, roundLabel: string): Promise<IPacket> {
        // A freshly chosen file wins; upload it so other moderators/the TD get it too.
        if (packetFile) {
            const { packet: parsed } = await readPacketFile(packetFile, setSetupMsg);
            setSetupMsg("");
            await KlaxonApi.savePacket(code, client.token, roundLabel, parsed);
            return parsed;
        }
        // Otherwise use the packet already stored for this round.
        if (serverPackets.indexOf(roundLabel) >= 0) {
            const stored = await KlaxonApi.getPacket<IPacket>(code, client.token, roundLabel);
            if (!Array.isArray(stored.tossups)) {
                throw new Error("Stored packet for this round is invalid.");
            }
            return stored;
        }
        throw new Error("Choose a packet file, or pick a round that already has one.");
    }

    // Fetch the round's errata + tiebreakers and enter the reading view. Shared
    // by the setup screen's Start button and the auto-resume path on reload.
    async function enterReading(
        client: KlaxonClient,
        roundLabel: string,
        packet: IPacket,
        rosters: IPlayer[],
        format: ITournamentFormat | undefined,
        massinger?: { teams: IGameTeam[]; board: IMassingerState; onEdit: () => void }
    ): Promise<void> {
        let errata: IErratum[] = [];
        try {
            const { errata: serverErrata } = await KlaxonApi.getErrata(code, client.token);
            errata = serverErrata.filter((e) => (e.round ?? "") === roundLabel).map(serverErratumToErratum);
        } catch {
            /* ignore */
        }

        let tiebreakers: ITiebreakerItem[] = [];
        try {
            const res = await KlaxonApi.getTiebreakers(code, client.token);
            tiebreakers = res.tiebreakers || [];
        } catch {
            /* none is fine */
        }

        // Teams/players (and their order) are set in MODAQ's New Game dialog;
        // pass the roster as its player pool.
        setRound(roundLabel);
        setConfig({
            packet,
            rosters,
            teams: massinger?.teams,
            board: massinger?.board,
            onEditPickBan: massinger?.onEdit,
            round: roundLabel,
            errata,
            tiebreakers,
            gameFormat: gameFormatFor(format),
        });
        setPhase("reading");
    }

    // Players a moderator adds mid-game flow back into the shared roster, so
    // re-fetch it when starting a round instead of trusting the page-load copy.
    // A roster the moderator uploaded themselves (BYO) is never clobbered.
    async function refreshCentralRoster(client: KlaxonClient): Promise<IPlayer[] | undefined> {
        if (!centralRoster) return undefined;
        try {
            const { roster } = await KlaxonApi.getRoster(code, client.token);
            if (!roster) return undefined;
            const parsed = QBJ.parseRegistration(roster);
            if (!parsed.success) return undefined;
            const list = parsed.value.map((p) => ({ name: p.name, teamName: p.teamName, isStarter: p.isStarter }));
            setRosterPlayers(list);
            return list;
        } catch {
            return undefined;
        }
    }

    async function onStart(): Promise<void> {
        const client = clientRef.current;
        if (!client) return;
        const roundLabel = round.trim() || "1";
        setStarting(true);
        setSetupMsg("");
        try {
            const packet = await loadPacketForStart(client, roundLabel);
            const freshRoster = await refreshCentralRoster(client);
            const rosters = freshRoster ?? rosterPlayers;
            if (massingerApplies(tournamentFormat, packet)) {
                // Players first: they make their own picks, so they have to be
                // in the room (and linked to their MODAQ player) before the
                // pick/ban can run. Lobby -> teams -> pick/ban.
                setPickban({ round: roundLabel, packet, rosters });
                setPhase("lobby");
                return;
            }
            await enterReading(client, roundLabel, packet, rosters, tournamentFormat);
        } catch (error) {
            setSetupMsg((error as Error).message);
        } finally {
            setStarting(false);
        }
    }

    if (phase === "connecting") {
        return (
            <div className="mod-center">
                <p>Connecting to room {code}…</p>
            </div>
        );
    }

    if (phase === "lite") {
        return <LiteReading code={code} client={clientRef.current!} roomState={roomState} />;
    }

    if (phase === "shootout-setup") {
        const hasSession = (roomState?.shootout?.session?.packets.length ?? 0) > 0;
        return (
            <ShootoutSetup
                code={code}
                client={clientRef.current!}
                roomState={roomState}
                onDone={() => setPhase("shootout")}
                onCancel={hasSession ? () => setPhase("shootout") : undefined}
            />
        );
    }

    if (phase === "shootout") {
        return (
            <ShootoutReading
                code={code}
                client={clientRef.current!}
                roomState={roomState}
                onEditSession={() => setPhase("shootout-setup")}
            />
        );
    }

    if (phase === "account") {
        return (
            <AccountGate
                strict={needsMembership}
                tcode={roomState?.tournamentCode || ""}
                onApproved={async () => {
                    // Now approved: fetch the centralized artifacts and go to setup
                    // (or straight back into a game that was being read). If the
                    // original socket join was denied (account-based access), a
                    // fresh join is needed — reload to redo the whole handshake.
                    const client = clientRef.current;
                    if (client && client.lastState) {
                        const boot = await bootstrap(client, client.lastState);
                        if (await tryResume(client, boot)) {
                            return;
                        }
                        setPhase("setup");
                        return;
                    }
                    location.reload();
                }}
            />
        );
    }

    if (phase === "error") {
        return (
            <div className="mod-center">
                <h1>Can&apos;t open the moderator view</h1>
                <p className="msg">{fatal}</p>
                {signInUrl ? (
                    <p>
                        <a href={signInUrl}>Sign in with your reader account →</a>
                    </p>
                ) : undefined}
                <p>
                    <a href={`/r/${code}`}>Back to the room</a>
                </p>
            </div>
        );
    }

    if (phase === "setup") {
        const scheduledRounds = (tournament?.schedule || []).filter((r) => r.room === code).map((r) => r.round);
        const trimmed = round.trim();
        const releasedForRound = serverPackets.indexOf(trimmed) >= 0;
        // A file the moderator picked themselves wins over the tournament's
        // packet for this round, so say plainly which one will actually be read.
        const packetReady = !!packetFile || releasedForRound;
        const canStart = !starting && packetReady;

        const chooseRound = (r: string): void => {
            setRound(r);
            setPacketFile(undefined); // going back to the tournament packet
            setSetupMsg("");
        };

        return (
            <div className="mod-center mod-setup">
                <h1>MODAQ moderator — room {code}</h1>
                {clientRef.current ? <DirectorMessages client={clientRef.current} /> : undefined}
                <p className="hint">
                    Choose the round and its packet, then start — teams are set in MODAQ&apos;s New Game dialog, and you
                    read with the Klaxon buzzer on the right.
                </p>

                {scheduledRounds.length > 0 && (
                    <>
                        <label>This room&apos;s scheduled rounds</label>
                        <div className="schedule-rounds">
                            {scheduledRounds.map((r) => (
                                <button
                                    key={r}
                                    className={trimmed === r ? "chip selected" : "chip"}
                                    aria-pressed={trimmed === r}
                                    onClick={() => chooseRound(r)}
                                >
                                    Round {r}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                <label>Packet</label>
                {serverPackets.length > 0 ? (
                    <div className="packet-choices">
                        {serverPackets.map((r) => {
                            const active = !packetFile && trimmed === r;
                            return (
                                <button
                                    key={r}
                                    className={active ? "packet-choice selected" : "packet-choice"}
                                    aria-pressed={active}
                                    onClick={() => chooseRound(r)}
                                >
                                    <span className="packet-choice-check">{active ? "●" : "○"}</span>
                                    <span>
                                        <strong>Round {r}</strong>
                                        <span className="packet-choice-sub">tournament packet</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="hint">
                        The director hasn&apos;t released a packet to this room yet — choose your own file below.
                    </p>
                )}

                <label htmlFor="packet">
                    {serverPackets.length > 0
                        ? "…or read your own packet (PDF, Word, or JSON)"
                        : "Packet file (PDF, Word, or JSON)"}
                </label>
                <input
                    id="packet"
                    type="file"
                    accept={PACKET_ACCEPT}
                    onChange={(e) => {
                        setPacketFile(e.target.files?.[0]);
                        setSetupMsg("");
                    }}
                />

                <label htmlFor="round">Round label</label>
                <input id="round" type="text" value={round} onChange={(e) => setRound(e.target.value)} />
                <p className="hint">
                    What this game is filed under in the tournament&apos;s stats. Picking a released round above sets it
                    for you.
                </p>

                <p className={packetReady ? "packet-status ready" : "packet-status"}>
                    {packetFile
                        ? `Reading “${packetFile.name}” — it will be saved as the packet for round “${trimmed}”.`
                        : releasedForRound
                        ? `Reading the tournament packet for round “${trimmed}”.`
                        : serverPackets.length > 0
                        ? `No packet for round “${trimmed}” — pick a released round above, or choose your own file.`
                        : "Choose a packet file to start."}
                </p>

                {centralRoster ? (
                    <p className="hint">
                        Using the tournament roster ({teams.length} teams) — pick the two teams and reorder players in
                        MODAQ&apos;s New Game dialog.
                    </p>
                ) : (
                    <>
                        <label htmlFor="roster">Roster (optional, .qbj / .json)</label>
                        <input
                            id="roster"
                            type="file"
                            accept=".qbj,.json,application/json"
                            onChange={(e) => onRosterFile(e.target.files?.[0])}
                        />
                        <p className="hint">
                            {teams.length > 0
                                ? `Roster loaded (${teams.length} teams) — pick the teams in MODAQ's New Game dialog.`
                                : "Upload a roster to prefill MODAQ's New Game, or set teams by hand in that dialog."}
                        </p>
                    </>
                )}

                <div>
                    <button className="primary" disabled={!canStart} onClick={onStart}>
                        {starting ? "Starting…" : "Start reading"}
                    </button>
                </div>
                <p className="msg">{setupMsg}</p>
                {clientRef.current && !roomState?.tournamentCode && (
                    <PreviousGames
                        client={clientRef.current}
                        showRound={true}
                        onLoad={async (g) => {
                            const client = clientRef.current!;
                            const game = await stagePreviousGame(client, g.id, (r) => `klaxon-${code}-${r}`);
                            try {
                                localStorage.setItem("bz_modaqLive:" + code, game.round);
                            } catch {
                                /* ignore */
                            }
                            // The snapshot carries its own packet; the server's copy
                            // (if the round's file is still there) is only a fallback.
                            let packet: IPacket = ({ tossups: [], bonuses: [] } as unknown) as IPacket;
                            try {
                                packet = await KlaxonApi.getPacket<IPacket>(code, client.token, game.round);
                            } catch {
                                /* fine */
                            }
                            setRound(game.round);
                            await enterReading(client, game.round, packet, rosterPlayers, tournamentFormat);
                        }}
                    />
                )}
            </div>
        );
    }

    if (phase === "lobby" && pickban) {
        return (
            <TeamLobby
                code={code}
                client={clientRef.current!}
                round={pickban.round}
                roomState={roomState}
                captainsWanted={(tournamentFormat?.massingerControl ?? "captain") === "captain"}
                initialTeams={pickban.teams}
                onCancel={() => {
                    setPickban(undefined);
                    setPhase("setup");
                }}
                onReady={(teams) => {
                    // The teams the room now agrees on: push them so buzzes are
                    // attributed, then run the pick/ban. (A game set up before
                    // anyone joins has nobody to attribute yet.)
                    if (teams.every((team) => team.players.length > 0)) {
                        clientRef.current?.massinger({ action: "set_modaq_teams", teams });
                    }
                    setPickban({ ...pickban, teams });
                    setPhase("pickban");
                }}
            />
        );
    }

    if (phase === "pickban" && pickban) {
        return (
            <PickBan
                code={code}
                client={clientRef.current!}
                round={pickban.round}
                packet={pickban.packet}
                gameTeams={pickban.teams ?? []}
                timerSecDefault={tournamentFormat?.massingerTimerSec ?? 30}
                controlDefault={tournamentFormat?.massingerControl ?? "captain"}
                roomState={roomState}
                onCancel={() => {
                    clientRef.current?.massinger({ action: "massinger_cancel", round: pickban.round });
                    setPickban(undefined);
                    setPhase("setup");
                }}
                onBackToTeams={() => setPhase("lobby")}
                onReady={async (board) => {
                    const client = clientRef.current;
                    if (!client) return;
                    await enterReading(
                        client,
                        pickban.round,
                        applyMassinger(pickban.packet, board),
                        pickban.rosters,
                        tournamentFormat,
                        { teams: pickban.teams ?? [], board, onEdit: () => setPhase("pickban") }
                    );
                }}
            />
        );
    }

    // phase === "reading"
    return (
        <Reading
            code={code}
            client={clientRef.current!}
            config={config!}
            roomState={roomState}
            onChange={() => {
                // A deliberate exit: a later reload should offer setup, not
                // auto-resume into the game that was just left.
                try {
                    localStorage.removeItem("bz_modaqLive:" + code);
                } catch {
                    /* ignore */
                }
                // The players' scoresheet belongs to the game being left, and
                // so does the shared copy other moderators would resume into;
                // the game itself is filed under previous games first.
                const c = clientRef.current;
                if (c) {
                    archiveCurrentGame(c).then(() => {
                        c.massinger({ action: "modaq_game", qbj: null });
                        c.pushSharedGame(round, null);
                    });
                }
                setPhase("setup");
            }}
        />
    );
}

// Who is connected to the room, and which MODAQ player each buzzer is linked
// to. Shown beside the pick/ban so the moderator can see that both teams are
// actually here (and able to make their own picks) before the phase runs.
function ConnectedPlayers(props: {
    roomState: IPublicRoomState | undefined;
    client?: KlaxonClient;
    // The two teams to offer, when they're known (after team entry).
    teamNames?: string[];
    // The team on the clock, highlighted during the pick/ban.
    picking?: string;
    // Captains only matter when the board is captain-controlled.
    showCaptains?: boolean;
    // Offer to remove someone from the room (a wrong room, a spectator who
    // joined as a player, a stale tab holding a name the real player needs).
    allowRemove?: boolean;
    // Before the teams exist there is nothing to link to, so the "not linked"
    // warning would just be noise.
    preTeams?: boolean;
}): JSX.Element {
    const { roomState, client, teamNames, picking, showCaptains, preTeams, allowRemove } = props;
    const members = (roomState?.members ?? []).filter((m) => m.role === "player");
    const teams = teamNames ?? [];
    const normTeam = (v: string | null | undefined): string =>
        (v ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    const unplaced = preTeams
        ? 0
        : teams.length >= 2
        ? members.filter((m) => !teams.some((name) => normTeam(name) === normTeam(m.effectiveTeam))).length
        : members.filter((m) => !m.rosterPlayer && !m.assignedTeam).length;

    const setTeam = (playerId: string, team: string): void => {
        client?.massinger({ action: "set_member_team", playerId, team });
    };
    const setCaptain = (playerId: string, captain: boolean): void => {
        client?.massinger({ action: "set_captain", playerId, captain });
    };
    const remove = (playerId: string, who: string): void => {
        if (window.confirm(`Remove ${who} from the room? They can rejoin from the player link.`)) {
            client?.massinger({ action: "remove_player", playerId });
        }
    };

    const same = (a: string | null | undefined, b: string | null | undefined): boolean => {
        const norm = (v: string | null | undefined): string =>
            (v ?? "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, " ")
                .trim();
        return norm(a) !== "" && norm(a) === norm(b);
    };

    return (
        <div className="ms-players">
            <h3>
                Connected players ({members.length})
                {unplaced > 0 && <span className="ms-unlinked"> · {unplaced} without a team</span>}
            </h3>
            {members.length === 0 ? (
                <p className="hint">Nobody has joined the room yet. They open the player link to buzz and pick.</p>
            ) : (
                <ul>
                    {members.map((member) => {
                        const team = member.effectiveTeam || member.team || "";
                        const onClock = picking != undefined && same(team, picking);
                        return (
                            <li key={member.id} className={member.connected ? "" : "gone"}>
                                <div className="ms-player-row">
                                    <span className="ms-player-name">
                                        {member.rosterPlayer || member.name}
                                        {member.rosterPlayer && member.rosterPlayer !== member.name && (
                                            <span className="ms-alias"> (joined as {member.name})</span>
                                        )}
                                        {!member.connected && <span className="ms-player-team"> · offline</span>}
                                    </span>
                                    {teams.length >= 2 && client ? (
                                        <select
                                            className={onClock ? "ms-team-select picking" : "ms-team-select"}
                                            aria-label={`Team for ${member.rosterPlayer || member.name}`}
                                            value={teams.find((t) => same(t, team)) ?? ""}
                                            onChange={(e) => setTeam(member.id, e.target.value)}
                                        >
                                            <option value="">no team</option>
                                            {teams.map((name) => (
                                                <option key={name} value={name}>
                                                    {name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className={onClock ? "ms-player-team picking" : "ms-player-team"}>
                                            {team || "no team"}
                                        </span>
                                    )}
                                </div>
                                {((showCaptains && team !== "") || allowRemove) && client && (
                                    <div className="ms-player-actions">
                                        {showCaptains && team !== "" && (
                                            <button
                                                className={member.isCaptain ? "ms-captain is-captain" : "ms-captain"}
                                                aria-pressed={member.isCaptain === true}
                                                onClick={() => setCaptain(member.id, !member.isCaptain)}
                                            >
                                                {member.isCaptain ? "★ captain" : "make captain"}
                                            </button>
                                        )}
                                        {allowRemove && (
                                            <button
                                                className="ms-remove"
                                                title="Remove from the room"
                                                onClick={() => remove(member.id, member.rosterPlayer || member.name)}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {unplaced > 0 && (
                <p className="hint">
                    A buzzer with no team still buzzes, but can&apos;t make its team&apos;s picks — put it on a team
                    above.
                </p>
            )}
        </div>
    );
}

// The waiting room, which is also where the game is set up. Everything the
// pick/ban needs is decided here: the two teams, and which connected buzzer is
// on each of them. That is what ties the web players to the teams MODAQ will
// score — MODAQ's own New Game comes later, prefilled from these choices, for
// the moderator to confirm.
function TeamLobby(props: {
    code: string;
    client: KlaxonClient;
    round: string;
    roomState: IPublicRoomState | undefined;
    captainsWanted: boolean;
    initialTeams?: IGameTeam[];
    onCancel: () => void;
    onReady: (teams: IGameTeam[]) => void;
}): JSX.Element {
    const { code, client, round, roomState, captainsWanted, initialTeams, onCancel, onReady } = props;

    // Team names come from the roster when the room has one, so they match what
    // the director registered (and what players picked when they joined).
    const rosterTeams = roomState?.roster?.teamNames ?? [];
    const [teamA, setTeamA] = React.useState(initialTeams?.[0]?.name ?? rosterTeams[0] ?? "");
    const [teamB, setTeamB] = React.useState(initialTeams?.[1]?.name ?? rosterTeams[1] ?? "");
    const [copied, setCopied] = React.useState(false);

    const players = (roomState?.members ?? []).filter((m) => m.role === "player");
    const connected = players.filter((m) => m.connected);

    const norm = (v: string | null | undefined): string =>
        (v ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    const teamNames = [teamA.trim(), teamB.trim()].filter((n) => n !== "");
    const namesReady = teamNames.length === 2 && norm(teamA) !== norm(teamB);

    const onTeam = (name: string): IRoomMember[] => connected.filter((m) => norm(m.effectiveTeam) === norm(name));
    const unassigned = connected.filter((m) => !teamNames.some((name) => norm(name) === norm(m.effectiveTeam)));

    const missingCaptains = captainsWanted ? teamNames.filter((name) => !onTeam(name).some((m) => m.isCaptain)) : [];
    const emptyTeams = namesReady ? teamNames.filter((name) => onTeam(name).length === 0) : [];
    const canStart = namesReady && unassigned.length === 0 && (connected.length === 0 || emptyTeams.length === 0);

    const link = `${location.origin}/${code}`;
    const copyLink = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(link);
        } catch {
            /* clipboard may be blocked */
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    };

    const teamField = (value: string, set: (v: string) => void, id: string, label: string): JSX.Element => (
        <>
            <label htmlFor={id}>{label}</label>
            {rosterTeams.length > 0 ? (
                <select id={id} value={rosterTeams.includes(value) ? value : ""} onChange={(e) => set(e.target.value)}>
                    <option value="">Choose a team…</option>
                    {rosterTeams.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            ) : (
                <input id={id} type="text" value={value} onChange={(e) => set(e.target.value)} />
            )}
        </>
    );

    return (
        <div className="mod-shell">
            <div className="mod-main">
                <div className="mod-center mod-setup">
                    <h1>Set up the game — room {code}</h1>
                    <p className="hint">
                        Round {round}. Pick the two teams and put every connected player on one of them; the pick/ban
                        runs next, and MODAQ opens after it with these teams already filled in.
                    </p>

                    <div className="lobby-link">
                        <code>{link}</code>
                        <button onClick={copyLink}>{copied ? "Copied!" : "Copy player link"}</button>
                    </div>

                    {teamField(teamA, setTeamA, "lobby-team-a", "First team")}
                    {teamField(teamB, setTeamB, "lobby-team-b", "Second team")}
                    {!namesReady && (
                        <p className="hint">
                            {teamNames.length < 2 ? "Choose both teams." : "The two teams have to be different."}
                        </p>
                    )}

                    <div className="lobby-count">
                        <span className="lobby-number">{connected.length}</span>
                        <span>{connected.length === 1 ? "player connected" : "players connected"}</span>
                    </div>

                    {namesReady && (
                        <div className="lobby-teams">
                            {teamNames.map((name) => {
                                const roster = onTeam(name);
                                return (
                                    <div key={name} className="lobby-team">
                                        <h3>
                                            {name} <span className="muted-count">({roster.length})</span>
                                        </h3>
                                        {roster.length === 0 ? (
                                            <p className="hint">Nobody on this team yet.</p>
                                        ) : (
                                            <ul>
                                                {roster.map((m) => (
                                                    <li key={m.id}>
                                                        {m.rosterPlayer || m.name}
                                                        {m.isCaptain && <span className="lobby-cap"> ★ captain</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {namesReady && unassigned.length > 0 && (
                        <div className="ms-warn">
                            {unassigned.length} player{unassigned.length === 1 ? "" : "s"} still need a team — set them
                            on the right, or remove them from the room.
                        </div>
                    )}
                    {namesReady && connected.length > 0 && unassigned.length === 0 && emptyTeams.length > 0 && (
                        <div className="ms-warn">Nobody is on {emptyTeams.join(" or ")} yet.</div>
                    )}
                    {canStart && missingCaptains.length > 0 && (
                        <div className="ms-warn">
                            No captain for {missingCaptains.join(" or ")} — the picks are captain-controlled, so mark
                            one on the right (or you can make their picks yourself).
                        </div>
                    )}
                    {connected.length === 0 && (
                        <p className="hint">
                            Nobody has joined yet. Send them the link above — a game can be set up without them, but
                            then every pick has to come from you.
                        </p>
                    )}

                    <div>
                        <button
                            className="primary"
                            disabled={!canStart}
                            onClick={() => {
                                // Commit what the lobby shows: a player who
                                // merely typed the right team name is only
                                // vouched for once the moderator's assignment
                                // says so, and that's what lets them pick.
                                for (const name of teamNames) {
                                    for (const member of onTeam(name)) {
                                        if (member.assignedTeam !== name) {
                                            client.massinger({
                                                action: "set_member_team",
                                                playerId: member.id,
                                                team: name,
                                            });
                                        }
                                    }
                                }
                                onReady(
                                    teamNames.map((name) => ({
                                        name,
                                        players: onTeam(name).map((m) => m.rosterPlayer || m.name),
                                    }))
                                );
                            }}
                        >
                            Continue to pick/ban →
                        </button>{" "}
                        <button onClick={onCancel}>Back to setup</button>
                    </div>
                </div>
            </div>
            <div className="mod-side">
                <ConnectedPlayers
                    roomState={roomState}
                    client={client}
                    teamNames={namesReady ? teamNames : undefined}
                    showCaptains={captainsWanted && namesReady}
                    allowRemove={true}
                />
                <BuzzPanel client={client} state={roomState} />
            </div>
        </div>
    );
}

const CONTROL_LABELS: { value: MassingerControl; label: string; hint: string }[] = [
    {
        value: "captain",
        label: "Each team's captain",
        hint: "Only the player you mark as captain picks for their team.",
    },
    {
        value: "anyone",
        label: "Anyone on the team",
        hint: "Any player the room knows to be on the team can pick for it.",
    },
    {
        value: "moderator",
        label: "Moderator only",
        hint: "Players just watch the board; you make every pick from here.",
    },
];

// --- MASSINGER pick/ban screen ---------------------------------------------
// The moderator drives the whole phase: which team is on the clock, applying
// each spoken protect/ban, and enforcing the pick timer. The board itself is
// server-authoritative (broadcast to players through room state), persisted
// per room+round so a reload resumes it.
function PickBan(props: {
    code: string;
    client: KlaxonClient;
    round: string;
    packet: IPacket;
    gameTeams: IGameTeam[];
    timerSecDefault: number;
    controlDefault: MassingerControl;
    roomState: IPublicRoomState | undefined;
    onCancel: () => void;
    onBackToTeams: () => void;
    onReady: (board: IMassingerState) => void;
}): JSX.Element {
    const {
        code,
        client,
        round,
        packet,
        gameTeams,
        timerSecDefault,
        controlDefault,
        roomState,
        onCancel,
        onBackToTeams,
        onReady,
    } = props;
    const board: IMassingerState | undefined =
        roomState?.massinger && roomState.massinger.round === round ? roomState.massinger : undefined;

    const [timerSec, setTimerSec] = React.useState(timerSecDefault);
    const [control, setControl] = React.useState<MassingerControl>(controlDefault);
    // Which of the two teams picks first, chosen from a list of the actual team
    // names — never typed, so a pick/ban can't run against a misspelled team
    // that matches nobody's buzzer.
    const [firstIndex, setFirstIndex] = React.useState(0);
    const captainOf = (team: string): IRoomMember | undefined =>
        (roomState?.members ?? []).find(
            (m) =>
                m.isCaptain === true &&
                (m.effectiveTeam ?? "")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, " ")
                    .trim() ===
                    team
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, " ")
                        .trim()
        );

    const teamOptions: string[] =
        gameTeams.length >= 2 ? gameTeams.map((team) => team.name) : roomState?.roster?.teamNames?.slice(0, 2) ?? [];
    const [msg, setMsg] = React.useState("");
    const [probed, setProbed] = React.useState(false);
    const [starting, setStarting] = React.useState(false);
    const [editing, setEditing] = React.useState(false);

    const missingCaptains = teamOptions.filter((name) => captainOf(name) == undefined);

    // Auto-resume a board persisted for this round (reload / server restart).
    React.useEffect(() => {
        client.massinger({ action: "massinger_start", round, resumeOnly: true }).then(() => setProbed(true));
    }, [client, round]);

    // Tick while a deadline is live so the countdown moves. The server is what
    // actually enforces it — this is only the display.
    const [, forceTick] = React.useReducer((n: number) => n + 1, 0);
    React.useEffect(() => {
        if (board?.status !== "active" || board.deadline == null) {
            return;
        }
        const timer = setInterval(forceTick, 250);
        return () => clearInterval(timer);
    }, [board?.status, board?.deadline]);

    const send = async (payload: Record<string, unknown>): Promise<void> => {
        setMsg("");
        const resp = await client.massinger(payload);
        if (resp.error) {
            setMsg("Server refused that: " + resp.error);
        }
    };

    const begin = async (fresh: boolean): Promise<void> => {
        setStarting(true);
        setMsg("");
        try {
            const resp = await client.massinger({
                action: "massinger_start",
                fresh,
                round,
                subcats: deriveSubcats(packet),
                teams: [teamOptions[firstIndex], teamOptions[1 - firstIndex]],
                timerSec,
                control,
                target: MASSINGER_TARGET,
            });
            if (resp.error) {
                setMsg("Couldn't start the pick/ban: " + resp.error);
            }
        } finally {
            setStarting(false);
        }
    };

    // --- start form (no board yet) ---
    if (!board) {
        return (
            <div className="mod-shell">
                <div className="mod-main">
                    <div className="mod-center mod-setup">
                        <h1>MASSINGER pick/ban — Round {round}</h1>
                        <p className="hint">
                            {packet.tossups.length} tossups in the packet. {teamOptions[0] ?? "The two teams"} and{" "}
                            {teamOptions[1] ?? "their opponent"} alternate protecting and banning subcategories until{" "}
                            {MASSINGER_TARGET} remain. Each team picks from their own room page; you can pick for them
                            (and undo or edit anything) here.
                        </p>
                        <label htmlFor="ms-first">Which team picks first?</label>
                        <select
                            id="ms-first"
                            value={firstIndex}
                            onChange={(e) => setFirstIndex(Number(e.target.value))}
                        >
                            {teamOptions.map((name, index) => (
                                <option key={name} value={index}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        <p className="hint">
                            The other team ({teamOptions[1 - firstIndex] ?? "—"}) picks second, and they alternate from
                            there. You can change whose turn it is at any point once the board is running.
                        </p>
                        <label htmlFor="ms-control">Who makes the picks?</label>
                        <select
                            id="ms-control"
                            value={control}
                            onChange={(e) => setControl(e.target.value as MassingerControl)}
                        >
                            {CONTROL_LABELS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="hint">
                            {CONTROL_LABELS.find((o) => o.value === control)?.hint}
                            {control !== "moderator" &&
                                " You can always pick on a team's behalf, and change this once the board is running."}
                        </p>
                        {control === "captain" && missingCaptains.length > 0 && (
                            <p className="ms-warn">
                                No captain yet for {missingCaptains.join(" or ")} — mark one in the players list on the
                                right (or their picks will have to come from you).
                            </p>
                        )}

                        <label htmlFor="ms-timer">Seconds per pick (0 = no timer)</label>
                        <input
                            id="ms-timer"
                            type="number"
                            min={0}
                            max={300}
                            value={timerSec}
                            onChange={(e) => setTimerSec(Number(e.target.value))}
                        />
                        <p className="hint">
                            When the timer runs out the server bans a random subcategory for the team on the clock.
                        </p>
                        <div>
                            <button
                                className="primary"
                                disabled={!probed || starting || teamOptions.length < 2}
                                onClick={() => begin(false)}
                            >
                                {teamOptions.length < 2
                                    ? "Set the teams first"
                                    : probed
                                    ? "Begin pick/ban"
                                    : "Checking for a saved board…"}
                            </button>{" "}
                            <button onClick={onBackToTeams}>Back to teams &amp; players</button>{" "}
                            <button onClick={onCancel}>Back to setup</button>
                        </div>
                        <p className="msg">{msg}</p>
                    </div>
                </div>
                <div className="mod-side">
                    <ConnectedPlayers
                        roomState={roomState}
                        client={client}
                        teamNames={teamOptions}
                        showCaptains={control === "captain"}
                        allowRemove={true}
                    />
                </div>
            </div>
        );
    }

    // --- live board ---
    const remaining = massingerRemaining(board);
    const bansLeft = remaining - board.target;
    const active = board.status === "active";
    const secondsLeft = board.deadline != null ? Math.max(0, Math.ceil((board.deadline - Date.now()) / 1000)) : null;
    const expired = active && secondsLeft === 0;
    const lastAction = board.actions[board.actions.length - 1];

    return (
        <div className="mod-shell">
            <div className="mod-main">
                <div className="mod-center mod-setup ms-screen">
                    <h1>MASSINGER pick/ban — Round {round}</h1>

                    {active ? (
                        <>
                            <div className={"ms-clockline" + (expired ? " expired" : "")}>
                                <span>
                                    <strong>{board.teams[board.turn]}</strong> is picking — protect or ban a
                                    subcategory.
                                </span>
                                {secondsLeft != null && (
                                    <span className="ms-clock">{expired ? "TIME’S UP" : `${secondsLeft}s`}</span>
                                )}
                            </div>
                            <div className="ms-turnrow">
                                <span className="hint">Picks made by:</span>
                                <select
                                    className="ms-control-live"
                                    aria-label="Who makes the picks"
                                    value={board.control}
                                    onChange={(e) => send({ action: "massinger_set_control", control: e.target.value })}
                                >
                                    {CONTROL_LABELS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {board.control === "captain" &&
                                    (captainOf(board.teams[board.turn]) ? (
                                        <span className="ms-captain-name">
                                            ★{" "}
                                            {captainOf(board.teams[board.turn])?.rosterPlayer ||
                                                captainOf(board.teams[board.turn])?.name}
                                        </span>
                                    ) : (
                                        <span className="ms-warn-inline">no captain for {board.teams[board.turn]}</span>
                                    ))}
                            </div>
                            <div className="ms-turnrow">
                                <span className="hint">Team on the clock:</span>
                                {[0, 1].map((team) => (
                                    <button
                                        key={team}
                                        className={board.turn === team ? "ms-turn active" : "ms-turn"}
                                        onClick={() => send({ action: "massinger_set_turn", team })}
                                    >
                                        {board.teams[team]}
                                    </button>
                                ))}
                            </div>
                            <p className="hint">
                                {remaining} questions remain — {bansLeft} more ban{bansLeft === 1 ? "" : "s"} to reach{" "}
                                {board.target}. The team picks on their own page; use the buttons below to pick for
                                them. Protecting makes every question in a subcategory unbannable; banning removes one
                                question (a doubled subcategory keeps its other question).
                            </p>
                        </>
                    ) : (
                        <p className="ms-doneline">Pick/ban complete — {remaining} questions remain.</p>
                    )}

                    {lastAction && (
                        <p className="ms-last">
                            Last: {board.teams[lastAction.team]}{" "}
                            {lastAction.type === "protect" ? "protected" : "banned"} <strong>{lastAction.label}</strong>
                            {lastAction.by === "timeout"
                                ? " (random — time expired)"
                                : lastAction.by && lastAction.by !== "moderator" && lastAction.by !== "random"
                                ? ` (by ${lastAction.by})`
                                : " (by you)"}
                        </p>
                    )}

                    <ul className="ms-list">
                        {board.subcats.map((subcat) => {
                            const left = subcat.indexes.length - subcat.banned;
                            const isProtected = subcat.protectedBy != null;
                            const gone = left === 0;
                            const status = gone
                                ? "✕ banned"
                                : isProtected
                                ? `🛡 ${board.teams[subcat.protectedBy!]}`
                                : subcat.banned > 0
                                ? `${subcat.banned} of ${subcat.indexes.length} banned`
                                : subcat.indexes.length > 1
                                ? `×${subcat.indexes.length}`
                                : "";
                            const touched = isProtected || subcat.banned > 0;
                            return (
                                <li key={subcat.label} className={gone ? "banned" : isProtected ? "protected" : ""}>
                                    <span className="ms-label">{subcat.label}</span>
                                    <span className="ms-mark">{status}</span>
                                    {editing && touched ? (
                                        <span className="ms-actions">
                                            <button
                                                onClick={() =>
                                                    send({ action: "massinger_reset_subcat", label: subcat.label })
                                                }
                                            >
                                                Clear
                                            </button>
                                        </span>
                                    ) : (
                                        active &&
                                        !gone &&
                                        !isProtected && (
                                            <span className="ms-actions">
                                                <button
                                                    onClick={() =>
                                                        send({
                                                            action: "massinger_pick",
                                                            type: "protect",
                                                            label: subcat.label,
                                                        })
                                                    }
                                                >
                                                    Protect
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        send({
                                                            action: "massinger_pick",
                                                            type: "ban",
                                                            label: subcat.label,
                                                        })
                                                    }
                                                >
                                                    Ban
                                                </button>
                                            </span>
                                        )
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    <div className="ms-controls">
                        {board.status === "done" ? (
                            <button className="primary" onClick={() => onReady(board)}>
                                Continue to the game ({remaining} questions)
                            </button>
                        ) : (
                            <button
                                className={expired ? "primary" : ""}
                                onClick={() => send({ action: "massinger_random_ban" })}
                            >
                                Random ban{expired ? " (time expired)" : ""}
                            </button>
                        )}
                        <button
                            disabled={board.actions.length === 0}
                            onClick={() => send({ action: "massinger_undo" })}
                        >
                            Undo last
                        </button>
                        <button className={editing ? "ms-turn active" : ""} onClick={() => setEditing(!editing)}>
                            {editing ? "Done editing" : "Edit picks"}
                        </button>
                        <button
                            onClick={() => {
                                if (window.confirm("Restart the pick/ban from scratch? All picks so far are lost.")) {
                                    begin(true);
                                }
                            }}
                        >
                            Restart
                        </button>
                        <button onClick={onCancel}>Back to setup</button>
                    </div>
                    {editing && (
                        <p className="hint">
                            Editing: “Clear” undoes everything done to that subcategory (its protect and any bans),
                            without unwinding the picks made after it.
                        </p>
                    )}
                    <p className="msg">{msg}</p>
                </div>
            </div>
            <div className="mod-side">
                <ConnectedPlayers
                    roomState={roomState}
                    client={client}
                    teamNames={board.teams}
                    picking={active ? board.teams[board.turn] : undefined}
                    showCaptains={board.control === "captain"}
                    allowRemove={true}
                />
            </div>
        </div>
    );
}

// Messages from the tournament director, shown as a banner above the reader
// until dismissed. Replayed messages (reconnects) are deduped by timestamp.
function DirectorMessages(props: { client: KlaxonClient }): JSX.Element | null {
    const [messages, setMessages] = React.useState<IDirectorMessage[]>([]);
    React.useEffect(
        () =>
            props.client.onDirectorMessage((m) =>
                setMessages((current) =>
                    current.some((x) => x.at === m.at && x.text === m.text) ? current : [...current, m].slice(-3)
                )
            ),
        [props.client]
    );
    if (messages.length === 0) {
        return null;
    }
    return (
        <div className="mod-director-msg" role="alert">
            <div>
                {messages.map((m) => (
                    <p key={`${m.at}-${m.text}`}>
                        <strong>Director:</strong> {m.text}
                    </p>
                ))}
            </div>
            <button onClick={() => setMessages([])}>Dismiss</button>
        </div>
    );
}

// Shared bar shown above the MODAQ reader: the room label, a copyable player
// join link, and a link to the normal Klaxon reader controls (buzzer options,
// invite links). The ?plain=1 keeps that page from redirecting back here.
function RoomToolbar(props: { code: string; label: string; children?: React.ReactNode }): JSX.Element {
    const [copied, setCopied] = React.useState(false);
    const copyLink = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(`${location.origin}/${props.code}`);
        } catch {
            /* clipboard may be blocked; ignore */
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };
    return (
        <div className="mod-changebar">
            <span>{props.label}</span>
            <span className="mod-toolbar-actions">
                <button onClick={copyLink}>{copied ? "Copied!" : "Copy player link"}</button>
                <a href={`/r/${props.code}?plain=1`} target="_blank" rel="noopener noreferrer">
                    Buzzer options ↗
                </a>
                {props.children}
            </span>
        </div>
    );
}

function Reading(props: {
    code: string;
    client: KlaxonClient;
    config: IReadingConfig;
    roomState: IPublicRoomState | undefined;
    onChange: () => void;
}): JSX.Element {
    const { code, client, config, roomState, onChange } = props;
    const token = client.token;
    const round = config.round;

    const customExport: ICustomExport = React.useMemo(
        () => ({
            label: "Autosaving to Klaxon",
            type: "QBJ",
            onExport: async (qbj: IMatch): Promise<IStatus> => {
                try {
                    // An explicit export is always final, even if the game ended early.
                    const result = await KlaxonApi.saveExport(code, token, round, qbj, false);
                    downloadFullBuzz(client);
                    try {
                        localStorage.removeItem("bz_modaqLive:" + code);
                    } catch {
                        /* ignore */
                    }
                    return { isError: false, status: `Saved to Klaxon (${result.filename})` };
                } catch (error) {
                    return { isError: true, status: "Save to Klaxon failed: " + (error as Error).message };
                }
            },
        }),
        [code, token, round]
    );

    // Live sync: push the QBJ to the server on every game change so the TD sees
    // current stats without the moderator exporting. Overwrites one file/match.
    // inProgress keeps a half-played game out of the W/L standings. The resume
    // marker (a reload of this page jumps straight back into this round instead
    // of the setup screen) stays set for the whole game — inProgress flips false
    // as soon as the reader REACHES the last question, so removing it here would
    // lose resume while that question is still being read. Only a deliberate
    // exit clears it: the explicit export or "Change round / teams".
    // Every mode links MODAQ's players to the connected buzzers: the teams from
    // the loaded game become the room's roster, so a buzz reports the player
    // MODAQ is scoring rather than whatever name they typed to join.
    const syncGame = useGameSync(client);
    const shared = useSharedGame(client, round);
    const ending = useEndGame(client, round);

    const onGameUpdate = React.useCallback(
        (
            qbj: IMatch,
            inProgress?: boolean,
            currentQuestion?: number,
            hasBonuses?: boolean,
            protests?: IGameUpdateProtest[],
            categories?: string[],
            answers?: string[],
            questions?: string[]
        ) => {
            try {
                localStorage.setItem("bz_modaqLive:" + code, round);
            } catch {
                /* storage may be unavailable; resume is best-effort */
            }
            syncGame(qbj, inProgress, currentQuestion, hasBonuses, protests, categories, answers, questions);
            KlaxonApi.saveExport(code, token, round, qbj, inProgress === true, currentQuestion).catch(() => {
                /* transient failures self-heal on the next change */
            });
        },
        [code, token, round, syncGame]
    );

    const onTiebreakerUsed = React.useCallback(
        (info: ITiebreakerItem & { teams: string[] }) => {
            KlaxonApi.tiebreakerUsed(code, token, {
                tbRound: info.round,
                questionNumber: info.questionNumber,
                gameRound: round,
                teams: info.teams,
            }).catch(() => {
                /* best-effort */
            });
        },
        [code, token, round]
    );

    // Judging a buzz in MODAQ resolves it: clear the Klaxon buzzer (or pass to
    // the next queued buzzer when a queue-mode answer was wrong).
    const onBuzzJudged = useJudgedHandler(client, roomState);
    const buzzedInPlayer = useBuzzedInPlayer(roomState);

    const onErrataChange = React.useCallback(
        (errata: IErratum[]) => {
            const entries: IServerErratum[] = errata.map((e) => ({
                questionNumber: e.questionNumber,
                questionType: e.questionType,
                thrownOut: e.thrownOut,
                text: e.text,
                at: e.at,
            }));
            KlaxonApi.putErrata(code, token, round, entries).catch(() => {
                /* best-effort; the moderator can retry by editing again */
            });
        },
        [code, token, round]
    );

    return (
        <div className="mod-shell">
            <div className="mod-main">
                <RoomToolbar code={code} label={`Room ${code} · Round ${round}`}>
                    <button onClick={onChange}>Change round / teams</button>
                    {ending.exported && (
                        <button
                            className="mod-endgame"
                            onClick={ending.endGame}
                            title="Back to the buzzer page (settings, players)"
                        >
                            End game →
                        </button>
                    )}
                </RoomToolbar>
                <DirectorMessages client={client} />
                <KlaxonModaq
                    applyStylingToRoot={false}
                    buildVersion={__BUILD_VERSION__}
                    yappServiceUrl={YAPP_SERVICE_URL}
                    newGameOnLoad={{
                        packet: config.packet,
                        packetName: `Round ${round}`,
                        rosters: config.rosters,
                        teams: config.teams,
                    }}
                    newGameNotice={
                        config.board ? <PickBanSummary board={config.board} onEdit={config.onEditPickBan} /> : undefined
                    }
                    gameFormat={config.gameFormat}
                    persistState={true}
                    storeName={`klaxon-${code}-${round}`}
                    errata={config.errata}
                    onErrataChange={onErrataChange}
                    onGameUpdate={onGameUpdate}
                    onBuzzJudged={onBuzzJudged}
                    buzzedInPlayer={buzzedInPlayer}
                    onExported={ending.onExported}
                    onPersistedState={shared.onPersistedState}
                    remoteState={shared.remoteState}
                    tiebreakers={config.tiebreakers}
                    onTiebreakerUsed={onTiebreakerUsed}
                    customExport={customExport}
                />
            </div>
            <div className="mod-side">
                <BuzzPanel client={client} state={roomState} />
            </div>
        </div>
    );
}

// The pick/ban result, shown inside MODAQ's New Game dialog so the moderator
// confirms what will actually be read before starting — and can go back and
// fix the board if something is wrong.
function PickBanSummary(props: { board: IMassingerState; onEdit?: () => void }): JSX.Element {
    const { board, onEdit } = props;
    const banned = board.subcats.filter((s) => s.banned > 0);
    const guarded = board.subcats.filter((s) => s.protectedBy != null);
    return (
        <div className="ms-summary">
            <div className="ms-summary-head">
                <strong>MASSINGER pick/ban — {massingerRemaining(board)} questions will be read</strong>
                {onEdit && (
                    <button className="ms-summary-edit" onClick={onEdit}>
                        Back to pick/ban
                    </button>
                )}
            </div>
            <div className="ms-summary-cols">
                <div>
                    <h4>Banned</h4>
                    {banned.length === 0 ? (
                        <p>Nothing banned.</p>
                    ) : (
                        <ul>
                            {banned.map((s) => (
                                <li key={s.label}>
                                    {s.label}
                                    {s.banned < s.indexes.length ? ` (1 of ${s.indexes.length} — one still in)` : ""}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div>
                    <h4>Protected</h4>
                    {guarded.length === 0 ? (
                        <p>Nothing protected.</p>
                    ) : (
                        <ul>
                            {guarded.map((s) => (
                                <li key={s.label}>
                                    {s.label} <span className="ms-summary-by">— {board.teams[s.protectedBy!]}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

// Lightweight MODAQ view: just the native MODAQ reader (its own New Game, packet
// loader, and export) beside the Klaxon buzz panel. No server roster/packets/
// exports/errata — nothing tournament-related.
function LiteReading(props: {
    code: string;
    client: KlaxonClient;
    roomState: IPublicRoomState | undefined;
}): JSX.Element {
    const { code, client, roomState } = props;
    const onBuzzJudged = useJudgedHandler(client, roomState);
    const buzzedInPlayer = useBuzzedInPlayer(roomState);
    // Lite mode has no tournament roster, but the teams entered in MODAQ's own
    // New Game dialog still link the buzzers to real players, and the room
    // still gets the live scoresheet.
    const syncGame = useGameSync(client);
    const shared = useSharedGame(client, "lite");
    const ending = useEndGame(client, "lite");
    const [showPrev, setShowPrev] = React.useState(false);
    // Loading a previous game remounts MODAQ so it reads the staged snapshot.
    const [gameKey, setGameKey] = React.useState(0);

    // Starting a game is one step: drop the packet (PDF, Word, or JSON) and
    // MODAQ's New Game dialog opens with it loaded and the teams filled in from
    // the room, so all that's left is Start. Shown whenever there's no game, and
    // again when the reader picks New game.
    const [gameLoaded, setGameLoaded] = React.useState<boolean | undefined>(undefined);
    const [picking, setPicking] = React.useState(false);
    const [hostGame, setHostGame] = React.useState<IHostNewGame | undefined>(undefined);
    const [status, setStatus] = React.useState("");
    const [error, setError] = React.useState("");
    const teams = teamsFromRoom(roomState);
    const onNewGameRequested = React.useCallback(() => setPicking(true), []);

    const onFiles = async (files: File[]): Promise<void> => {
        setError("");
        try {
            const { packet, name } = await readPacketFile(files[0], setStatus);
            // The game on screen is filed first, so nothing is lost.
            if (gameLoaded) {
                await archiveCurrentGame(client);
            }
            setHostGame({ packet, packetName: name, teams, confirm: true });
            setPicking(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setStatus("");
        }
    };

    const showStart = gameLoaded === false || picking;
    return (
        <div className="mod-shell">
            <div className="mod-main">
                <RoomToolbar code={code} label={`Room ${code} · MODAQ`}>
                    {gameLoaded && !picking && <button onClick={() => setPicking(true)}>New packet</button>}
                    <button onClick={() => setShowPrev((v) => !v)}>
                        {showPrev ? "Hide previous games" : "Previous games"}
                    </button>
                    {ending.exported && (
                        <button
                            className="mod-endgame"
                            onClick={ending.endGame}
                            title="Back to the buzzer page (settings, players)"
                        >
                            End game →
                        </button>
                    )}
                </RoomToolbar>
                <DirectorMessages client={client} />
                {showPrev && (
                    <PreviousGames
                        client={client}
                        showRound={false}
                        showWhenEmpty={true}
                        onLoad={async (g) => {
                            // The game on screen is filed first, so nothing is lost.
                            if (client.lastState?.scoresheet) {
                                await archiveCurrentGame(client);
                            }
                            await stagePreviousGame(client, g.id, () => `klaxon-lite-${code}`);
                            setShowPrev(false);
                            // A remounted MODAQ must not start the last dropped packet again.
                            setHostGame(undefined);
                            setGameKey((k) => k + 1);
                        }}
                    />
                )}
                {showStart && (
                    <div className="pk-start">
                        <div className="pk-start-head">
                            <h2>{gameLoaded ? "Read another packet" : "Start a game"}</h2>
                            {gameLoaded && (
                                <button onClick={() => setPicking(false)} disabled={status !== ""}>
                                    Back to the game
                                </button>
                            )}
                        </div>
                        <PacketDrop
                            pageWide
                            disabled={status !== ""}
                            onFiles={onFiles}
                            title={status || "Drop the packet anywhere on this page"}
                            hint="A PDF, a Word document (.docx), or a packet JSON file"
                        />
                        {error && <p className="pk-error">{error}</p>}
                        <p className="hint">
                            {teams.length >= 2
                                ? `Teams from the room: ${teams
                                      .map((t) => `${t.name} (${t.players.join(", ")})`)
                                      .join(" vs. ")}. They'll be filled in — check them and press Start.`
                                : "Next, name the teams and press Start. (Players who give a team when they join are filled in for you.)"}
                        </p>
                    </div>
                )}
                <div className={showStart && !gameLoaded ? "mod-modaq-idle" : undefined}>
                    <KlaxonModaq
                        key={gameKey}
                        applyStylingToRoot={false}
                        buildVersion={__BUILD_VERSION__}
                        yappServiceUrl={YAPP_SERVICE_URL}
                        packetParserLink={PACKET_PARSER_LINK}
                        persistState={true}
                        storeName={`klaxon-lite-${code}`}
                        onGameUpdate={syncGame}
                        onBuzzJudged={onBuzzJudged}
                        buzzedInPlayer={buzzedInPlayer}
                        onExported={() => {
                            ending.onExported();
                            downloadFullBuzz(client);
                        }}
                        onPersistedState={shared.onPersistedState}
                        remoteState={shared.remoteState}
                        hostNewGame={hostGame}
                        onNewGameRequested={onNewGameRequested}
                        onGameLoadedChange={setGameLoaded}
                    />
                </div>
            </div>
            <div className="mod-side">
                <BuzzPanel client={client} state={roomState} />
            </div>
        </div>
    );
}

// The teams a room already knows about, for a game started from a dropped
// packet: the room's roster if it has one (a previous game's teams, or a
// roster the reader loaded), otherwise the teams players gave when they
// joined. Fewer than two is no teams at all — the reader names them.
function teamsFromRoom(state: IPublicRoomState | undefined): IHostTeam[] {
    const roster = (state?.roster?.teams ?? []).filter((t) => t.name && t.players.length > 0);
    if (roster.length >= 2) {
        return roster.map((t) => ({ name: t.name, players: [...t.players] }));
    }
    const byTeam = new Map<string, string[]>();
    for (const m of state?.members ?? []) {
        if (m.role !== "player" || !m.connected) continue;
        const team = (m.effectiveTeam ?? m.team ?? "").trim();
        if (!team) continue;
        const players = byTeam.get(team) ?? [];
        players.push(m.rosterPlayer || m.displayName || m.name);
        byTeam.set(team, players);
    }
    const teams = Array.from(byTeam.entries()).map(([name, players]) => ({ name, players }));
    return teams.length >= 2 ? teams : [];
}

// --- Discord shootout ----------------------------------------------------------
// Everyone plays for themselves, and whoever is in the room is playing: the host
// never enters a roster. They set the evening up once — what's being played,
// notes for the room, how a withdrawn buzz is handled, the packets — send the
// link, and read. MODAQ keeps its game in step with the room: a player who joins
// is in the game from the question being read, one who leaves (or drops off for
// longer than a moment) stops hearing tossups from the next question.

// A dropped connection isn't leaving. Laptops sleep, Wi-Fi blips and pages
// reload; any of those comes back within seconds, and counting it as a
// departure would pepper the game with leave/join pairs.
const PRESENCE_GRACE_MS = 20000;

const competitorName = (m: IRoomMember): string =>
    (m.displayName || m.name || "").replace(/\s+/g, " ").trim().slice(0, 40);

// The room's players as MODAQ's competitors, each marked present or not. Names
// are the ones the server builds the shootout roster from (see the Klaxon
// server's shootout.roster), so a buzz links to the right MODAQ player.
function useShootoutPresence(roomState: IPublicRoomState | undefined): ILiveTeam[] {
    const goneSince = React.useRef(new Map<string, number>());
    const [tick, setTick] = React.useState(0);
    const now = Date.now();
    const byName = new Map<string, { name: string; present: boolean }>();
    let wakeIn = Infinity;
    for (const m of roomState?.members ?? []) {
        if (m.role !== "player") continue;
        const name = competitorName(m);
        if (!name) continue;
        let present = m.connected;
        if (m.connected) {
            goneSince.current.delete(m.id);
        } else {
            const since = goneSince.current.get(m.id) ?? now;
            goneSince.current.set(m.id, since);
            if (now - since < PRESENCE_GRACE_MS) {
                present = true;
                wakeIn = Math.min(wakeIn, since + PRESENCE_GRACE_MS - now);
            }
        }
        // Two members under one name are one competitor (the server's roster
        // merges them the same way); here if either is.
        const key = name.toLowerCase();
        const seen = byName.get(key);
        byName.set(key, { name: seen?.name ?? name, present: (seen?.present ?? false) || present });
    }
    const list: ILiveTeam[] = Array.from(byName.values()).map((c) => ({
        name: c.name,
        players: [c.name],
        present: c.present,
    }));
    const key = JSON.stringify(list);
    // Look again when the first grace period runs out.
    React.useEffect(() => {
        if (wakeIn === Infinity) return;
        const timer = setTimeout(() => setTick((t) => t + 1), wakeIn + 50);
        return () => clearTimeout(timer);
    }, [key, tick, wakeIn]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return React.useMemo(() => list, [key]);
}

const SCHEMES: { value: string; label: string }[] = [
    { value: "15/10/-5", label: "15 / 10 / −5 (powers)" },
    { value: "20/15/10/-5", label: "20 / 15 / 10 / −5 (superpowers)" },
    { value: "20/10/0", label: "20 / 10 / 0 (no negs)" },
];

function shootoutGameFormat(scoring: { scheme: string; bonuses: boolean } | undefined): IGameFormat | undefined {
    return gameFormatFor({ tossupScheme: scoring?.scheme ?? "15/10/-5", hasBonuses: scoring?.bonuses === true });
}

const WITHDRAW_CHOICES: { value: WithdrawMode; label: string; detail: string }[] = [
    {
        value: "free",
        label: "Free withdraws",
        detail: "A player can take back a buzz at no cost.",
    },
    {
        value: "none",
        label: "No withdraws",
        detail: "A buzz stands once it's in.",
    },
    {
        value: "typed",
        label: "Type your answer first",
        detail:
            "Everyone waiting in the buzz queue types their answer before the player with the floor gives theirs. " +
            "Withdrawing is only free if you hadn't committed to a different answer.",
    },
];

interface ISetupRow {
    key: string;
    id?: string; // set once it's stored on the server
    name: string;
    tossups: number;
    bonuses: number;
    status: "reading" | "saved" | "error";
    message?: string;
}

const newPacketId = (): string => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function ShootoutSetup(props: {
    code: string;
    client: KlaxonClient;
    roomState: IPublicRoomState | undefined;
    onDone: () => void;
    onCancel?: () => void;
}): JSX.Element {
    const { code, client, roomState, onDone, onCancel } = props;
    // Taken once: the form is the host's until they save it.
    const [initial] = React.useState<IShootoutSession | null>(() => roomState?.shootout?.session ?? null);
    const [name, setName] = React.useState(initial?.name ?? "");
    const [notes, setNotes] = React.useState(initial?.notes ?? "");
    const [withdraw, setWithdraw] = React.useState<WithdrawMode>(initial?.withdraw ?? "free");
    const [scheme, setScheme] = React.useState(initial?.scoring.scheme ?? "15/10/-5");
    const [bonuses, setBonuses] = React.useState(initial?.scoring.bonuses ?? false);
    const [rows, setRows] = React.useState<ISetupRow[]>(() =>
        (initial?.packets ?? []).map((p) => ({
            key: p.id,
            id: p.id,
            name: p.name,
            tossups: p.tossups,
            bonuses: p.bonuses,
            status: "saved",
        }))
    );
    const [saving, setSaving] = React.useState(false);
    const [msg, setMsg] = React.useState("");
    const [copied, setCopied] = React.useState(false);

    const update = (key: string, change: Partial<ISetupRow>): void =>
        setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));

    // Read the files one after another (the parser is shared, and a set of
    // twelve packets shouldn't arrive as twelve simultaneous uploads), and
    // store each on the server as soon as it's read.
    const queue = React.useRef<Promise<void>>(Promise.resolve());
    const onFiles = (files: File[]): void => {
        setMsg("");
        const added: ISetupRow[] = files.map((file) => ({
            key: newPacketId(),
            name: fileStem(file),
            tossups: 0,
            bonuses: 0,
            status: "reading",
            message: "Waiting…",
        }));
        setRows((list) => [...list, ...added]);
        files.forEach((file, i) => {
            const row = added[i];
            queue.current = queue.current.then(async () => {
                try {
                    update(row.key, { message: "Reading…" });
                    const { packet } = await readPacketFile(file, (text) => update(row.key, { message: text }));
                    update(row.key, { message: "Saving…" });
                    const id = row.key;
                    await KlaxonApi.savePacket(code, client.token, id, packet);
                    update(row.key, {
                        id,
                        status: "saved",
                        message: undefined,
                        tossups: packet.tossups.length,
                        bonuses: packet.bonuses?.length ?? 0,
                    });
                } catch (e) {
                    update(row.key, { status: "error", message: (e as Error).message });
                }
            });
        });
    };

    const move = (key: string, by: number): void =>
        setRows((list) => {
            const i = list.findIndex((r) => r.key === key);
            const j = i + by;
            if (i < 0 || j < 0 || j >= list.length) return list;
            const next = [...list];
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });

    const saved = rows.filter((r) => r.status === "saved" && r.id);
    const reading = rows.some((r) => r.status === "reading");
    const canSave = !saving && !reading && saved.length > 0;
    const link = `${location.origin}/${code}`;

    const save = async (): Promise<void> => {
        setSaving(true);
        setMsg("");
        try {
            const r = await client.massinger({
                action: "shootout_session",
                session: {
                    name: name.trim(),
                    notes,
                    withdraw,
                    scoring: { scheme, bonuses },
                    packets: saved.map((p) => ({
                        id: p.id,
                        name: p.name.trim(),
                        tossups: p.tossups,
                        bonuses: p.bonuses,
                    })),
                },
            });
            if (r.error) throw new Error(r.error);
            onDone();
        } catch (e) {
            setMsg("Couldn't save: " + (e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    // The buzz panel sits beside the form: people turn up (and start talking)
    // while the host is still setting up, and the host should see them.
    return (
        <div className="mod-shell">
            <div className="mod-main">
                <div className="mod-center mod-setup so-setup">
                    <h1>{initial ? "Edit the shootout" : "Set up a Discord shootout"}</h1>
                    <p className="hint">
                        Everyone plays for themselves. Whoever opens the link is in the game as soon as they join — no
                        roster to enter — and the scores add up across every packet you read.
                    </p>

                    <label htmlFor="so-name">What are you playing?</label>
                    <input
                        id="so-name"
                        type="text"
                        maxLength={80}
                        placeholder="e.g. 2026 Fall Novice playtest"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />

                    <label htmlFor="so-notes">Notes for the players</label>
                    <textarea
                        id="so-notes"
                        rows={4}
                        maxLength={2000}
                        placeholder="What kind of questions these are, what you're playtesting, anything else the room should know."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                    <p className="hint">Shown on every player&apos;s screen for the whole session.</p>

                    <label>Packets</label>
                    <PacketDrop
                        multiple
                        pageWide
                        onFiles={onFiles}
                        title="Drop the packets here, in any order"
                        hint="PDFs, Word documents (.docx), or packet JSON — reorder them below"
                    />
                    {rows.length > 0 && (
                        <ol className="so-packets">
                            {rows.map((r, i) => (
                                <li key={r.key} className={`so-packet ${r.status}`}>
                                    <span className="so-packet-num">{i + 1}.</span>
                                    <input
                                        type="text"
                                        aria-label={`Name of packet ${i + 1}`}
                                        maxLength={80}
                                        value={r.name}
                                        onChange={(e) => update(r.key, { name: e.target.value })}
                                    />
                                    <span className="so-packet-info">
                                        {r.status === "saved"
                                            ? `${r.tossups} tossups${r.bonuses ? ` · ${r.bonuses} bonuses` : ""}`
                                            : r.message}
                                    </span>
                                    <span className="so-packet-actions">
                                        <button
                                            onClick={() => move(r.key, -1)}
                                            disabled={i === 0}
                                            aria-label="Move up"
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={() => move(r.key, 1)}
                                            disabled={i === rows.length - 1}
                                            aria-label="Move down"
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                                            disabled={r.status === "reading"}
                                            aria-label="Remove"
                                            title="Remove"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}

                    <fieldset className="so-withdraw">
                        <legend>Withdrawing a buzz</legend>
                        {WITHDRAW_CHOICES.map((c) => (
                            <label key={c.value} className={withdraw === c.value ? "so-choice selected" : "so-choice"}>
                                <input
                                    type="radio"
                                    name="so-withdraw"
                                    value={c.value}
                                    checked={withdraw === c.value}
                                    onChange={() => setWithdraw(c.value)}
                                />
                                <span>
                                    <strong>{c.label}</strong>
                                    <span className="so-choice-detail">{c.detail}</span>
                                </span>
                            </label>
                        ))}
                    </fieldset>

                    <div className="so-scoring">
                        <label htmlFor="so-scheme">Scoring</label>
                        <select id="so-scheme" value={scheme} onChange={(e) => setScheme(e.target.value)}>
                            {SCHEMES.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                        <label className="so-check">
                            <input type="checkbox" checked={bonuses} onChange={(e) => setBonuses(e.target.checked)} />{" "}
                            Read bonuses too
                        </label>
                    </div>

                    <label>Invite link — post it in Discord</label>
                    <div className="so-link">
                        <code>{link}</code>
                        <button
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(link);
                                } catch {
                                    /* clipboard may be blocked */
                                }
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1200);
                            }}
                        >
                            {copied ? "Copied!" : "Copy"}
                        </button>
                    </div>

                    <div className="so-actions">
                        <button className="primary" disabled={!canSave} onClick={save}>
                            {saving ? "Saving…" : initial ? "Save changes" : "Open the room →"}
                        </button>
                        {onCancel && <button onClick={onCancel}>Cancel</button>}
                    </div>
                    <p className="msg">
                        {msg ||
                            (reading
                                ? "Reading the packets…"
                                : saved.length === 0
                                ? "Add at least one packet to start."
                                : "")}
                    </p>
                </div>
            </div>
            <div className="mod-side">
                <BuzzPanel client={client} state={roomState} />
            </div>
        </div>
    );
}

function ShootoutReading(props: {
    code: string;
    client: KlaxonClient;
    roomState: IPublicRoomState | undefined;
    onEditSession: () => void;
}): JSX.Element {
    const { code, client, roomState, onEditSession } = props;
    const session = roomState?.shootout?.session ?? null;
    const onBuzzJudged = useJudgedHandler(client, roomState);
    const buzzedInPlayer = useBuzzedInPlayer(roomState);
    const syncGame = useGameSync(client);
    const shared = useSharedGame(client, "lite");
    const competitors = useShootoutPresence(roomState);

    const [gameLoaded, setGameLoaded] = React.useState<boolean | undefined>(undefined);
    const [hostGame, setHostGame] = React.useState<IHostNewGame | undefined>(undefined);
    const [busy, setBusy] = React.useState("");
    const [msg, setMsg] = React.useState("");
    // Which packet the game on screen is, and how far it has got.
    const gamePacket = React.useRef<string | null>(session?.current ?? null);
    const lastGame = React.useRef<{ qbj: IMatch; inProgress: boolean; question?: number } | undefined>(undefined);
    const [progress, setProgress] = React.useState<{ question: number; inProgress: boolean } | undefined>(undefined);

    const index = session?.currentIndex ?? -1;
    const packets = session?.packets ?? [];
    const next = packets[index + 1];
    const scheme = session?.scoring.scheme ?? "15/10/-5";
    const withBonuses = session?.scoring.bonuses === true;
    const format = React.useMemo(() => shootoutGameFormat({ scheme, bonuses: withBonuses }), [scheme, withBonuses]);

    const startPacket = React.useCallback(
        async (i: number): Promise<void> => {
            const p = packets[i];
            if (!p) return;
            setBusy(`Loading ${p.name}…`);
            setMsg("");
            try {
                const packet = await KlaxonApi.getPacket<IPacket>(code, client.token, p.id);
                if (gameLoaded) {
                    await saveLast();
                    await archiveCurrentGame(client);
                }
                await client.massinger({ action: "shootout_current", packet: p.id });
                gamePacket.current = p.id;
                lastGame.current = undefined;
                setProgress(undefined);
                // Whoever is here now; anyone who arrives later is added as they do.
                setHostGame({
                    packet,
                    packetName: p.name,
                    teams: competitors.filter((c) => c.present),
                    gameFormat: format,
                });
            } catch (e) {
                setMsg(`Couldn't load ${p.name}: ${(e as Error).message}`);
            } finally {
                setBusy("");
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [packets, code, client, gameLoaded, competitors, format]
    );

    // A fresh room: the first packet (or the one the session says is next)
    // goes straight in. The reader just reads.
    const autoStarted = React.useRef(false);
    React.useEffect(() => {
        if (gameLoaded === false && !autoStarted.current && packets.length > 0) {
            autoStarted.current = true;
            startPacket(Math.max(index, 0));
        }
    }, [gameLoaded, packets.length, index, startPacket]);

    // The latest state of the game, kept as the packet's game on the server:
    // that's what the export at the end is built from.
    async function saveLast(): Promise<void> {
        const g = lastGame.current;
        const id = gamePacket.current;
        if (!g || !id) return;
        try {
            await KlaxonApi.saveExport(code, client.token, id, g.qbj, g.inProgress, g.question);
        } catch {
            /* the live sync has saved all but the last change */
        }
    }

    // Read through a ref: the session is a new object on every room broadcast,
    // and a callback that changed with it would have MODAQ re-subscribe — and
    // drop its pending (debounced) update — every time anyone so much as buzzed.
    const packetsRef = React.useRef(packets);
    packetsRef.current = packets;
    const onGameUpdate = React.useCallback(
        (
            qbj: IMatch,
            inProgress?: boolean,
            currentQuestion?: number,
            hasBonuses?: boolean,
            protests?: IGameUpdateProtest[],
            categories?: string[],
            answers?: string[],
            questions?: string[]
        ) => {
            syncGame(qbj, inProgress, currentQuestion, hasBonuses, protests, categories, answers, questions);
            const id = gamePacket.current;
            const p = packetsRef.current.find((x) => x.id === id);
            // A late update from the previous packet's game mustn't land on this one.
            if (!id || (p && qbj.packets && qbj.packets !== p.name)) return;
            lastGame.current = { qbj, inProgress: inProgress === true, question: currentQuestion };
            setProgress({ question: currentQuestion ?? 0, inProgress: inProgress === true });
            KlaxonApi.saveExport(code, client.token, id, qbj, inProgress === true, currentQuestion).catch(() => {
                /* the next change saves it again */
            });
        },
        [syncGame, code, client]
    );

    const goNext = (): void => {
        if (!next) {
            onEditSession();
            return;
        }
        const current = packets[index];
        if (
            current &&
            progress?.inProgress &&
            !window.confirm(
                `${current.name} isn't finished (question ${progress.question} of ${current.tossups}). Start ${next.name} anyway?`
            )
        ) {
            return;
        }
        startPacket(index + 1);
    };
    // MODAQ's New game command does the same, through a callback that never changes.
    const goNextRef = React.useRef(goNext);
    goNextRef.current = goNext;
    const onNewGameRequested = React.useCallback(() => goNextRef.current(), []);

    const exportAll = async (): Promise<void> => {
        setBusy("Preparing the export…");
        await saveLast();
        setBusy("");
        const a = document.createElement("a");
        a.href = KlaxonApi.shootoutExportUrl(code, client.token);
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const current = packets[index];
    const label = session
        ? `${session.name}${current ? ` · Packet ${index + 1} of ${packets.length}: ${current.name}` : ""}`
        : `Room ${code}`;
    const here = competitors.filter((c) => c.present).length;

    return (
        <div className="mod-shell">
            <div className="mod-main">
                <RoomToolbar code={code} label={label}>
                    <button className="primary" onClick={goNext} disabled={busy !== "" || gameLoaded === undefined}>
                        {next ? `Next packet: ${next.name} →` : "Add more packets"}
                    </button>
                    <button
                        onClick={exportAll}
                        disabled={busy !== "" || index < 0}
                        title="Packets and games, laid out for quizbowlbuzzpoints.com"
                    >
                        Export for buzzpoints ⤓
                    </button>
                    <button onClick={onEditSession} disabled={busy !== ""}>
                        Edit session
                    </button>
                </RoomToolbar>
                <DirectorMessages client={client} />
                {(busy || msg) && <p className={msg ? "pk-error so-status" : "so-status"}>{msg || busy}</p>}
                {gameLoaded && here === 0 && (
                    <p className="so-status">
                        Nobody has joined yet — send the player link. Players are added to the game as they arrive.
                    </p>
                )}
                <KlaxonModaq
                    applyStylingToRoot={false}
                    buildVersion={__BUILD_VERSION__}
                    persistState={true}
                    storeName={`klaxon-lite-${code}`}
                    onGameUpdate={onGameUpdate}
                    onBuzzJudged={onBuzzJudged}
                    buzzedInPlayer={buzzedInPlayer}
                    onPersistedState={shared.onPersistedState}
                    remoteState={shared.remoteState}
                    hostNewGame={hostGame}
                    onNewGameRequested={onNewGameRequested}
                    onGameLoadedChange={setGameLoaded}
                    liveTeams={competitors}
                />
            </div>
            <div className="mod-side">
                <BuzzPanel client={client} state={roomState} />
            </div>
        </div>
    );
}

// Login / register + request-access gate. Default mode gates packet reads for
// tournaments that require approved reader accounts (auto-passes when the
// tournament doesn't). `strict` gates account-based MODERATION — joining a
// room without its reader link — which always needs an actual approved
// membership, regardless of the tournament's reader-account setting.
function AccountGate(props: { tcode: string; onApproved: () => void; strict?: boolean }): JSX.Element {
    const { tcode, onApproved, strict } = props;
    const [checking, setChecking] = React.useState(true);
    const [loggedIn, setLoggedIn] = React.useState(false);
    const [status, setStatus] = React.useState<string | null>(null);
    const [mode, setMode] = React.useState<"login" | "register">("login");
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [msg, setMsg] = React.useState("");

    const refresh = React.useCallback(async () => {
        setChecking(true);
        let isIn = false;
        if (sessionToken()) {
            try {
                await KlaxonApi.me();
                isIn = true;
            } catch {
                localStorage.removeItem("bz_sessionToken");
            }
        }
        setLoggedIn(isIn);
        if (isIn) {
            try {
                const a = await KlaxonApi.getAccess(tcode);
                const effective = strict ? a.memberStatus ?? null : a.status;
                setStatus(effective);
                if (effective === "approved") {
                    onApproved();
                    return;
                }
            } catch {
                /* ignore */
            }
        }
        setChecking(false);
    }, [tcode, onApproved, strict]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const submit = async (): Promise<void> => {
        setMsg("");
        try {
            if (mode === "register") await KlaxonApi.register(username.trim(), password);
            else await KlaxonApi.login(username.trim(), password);
            setPassword("");
            await refresh();
        } catch (e) {
            setMsg(
                (e as Error).message === "username_taken"
                    ? "That username is taken."
                    : (e as Error).message === "bad_credentials"
                    ? "Wrong username or password."
                    : (e as Error).message === "bad_password"
                    ? "Password must be at least 6 characters."
                    : (e as Error).message === "bad_username"
                    ? "Username must be 3–30 letters/numbers."
                    : "Could not sign in: " + (e as Error).message
            );
        }
    };

    const request = async (): Promise<void> => {
        setMsg("");
        try {
            const r = await KlaxonApi.requestAccess(tcode);
            setStatus(r.status);
        } catch (e) {
            setMsg("Could not request access: " + (e as Error).message);
        }
    };

    const logout = (): void => {
        localStorage.removeItem("bz_sessionToken");
        setLoggedIn(false);
        setStatus(null);
    };

    if (checking) {
        return (
            <div className="mod-center">
                <p>Checking access…</p>
            </div>
        );
    }

    if (!loggedIn) {
        return (
            <div className="mod-center mod-setup">
                <h1>Reader sign-in</h1>
                <p className="hint">This tournament requires an approved reader account to read its packets.</p>
                <div className="schedule-rounds">
                    <button onClick={() => setMode("login")} disabled={mode === "login"}>
                        Log in
                    </button>
                    <button onClick={() => setMode("register")} disabled={mode === "register"}>
                        Create account
                    </button>
                </div>
                <label htmlFor="acct-user">Username</label>
                <input id="acct-user" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
                <label htmlFor="acct-pass">Password</label>
                <input
                    id="acct-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") submit();
                    }}
                />
                <div>
                    <button className="primary" onClick={submit}>
                        {mode === "register" ? "Create account" : "Log in"}
                    </button>
                </div>
                <p className="msg">{msg}</p>
            </div>
        );
    }

    return (
        <div className="mod-center mod-setup">
            <h1>Reader access</h1>
            {status === "pending" && (
                <>
                    <p>
                        Your request is <strong>pending</strong> the tournament director&apos;s approval.
                    </p>
                    <div>
                        <button className="primary" onClick={refresh}>
                            Check again
                        </button>
                    </div>
                </>
            )}
            {status === "denied" && <p className="msg">Your access request was denied by the director.</p>}
            {status == null && (
                <>
                    <p>You&apos;re signed in. Request access to read this tournament&apos;s packets.</p>
                    <div>
                        <button className="primary" onClick={request}>
                            Request access
                        </button>
                    </div>
                </>
            )}
            <p className="msg">{msg}</p>
            <p className="hint">
                <a
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        logout();
                    }}
                >
                    Sign out
                </a>
            </p>
        </div>
    );
}

function renderApp(): void {
    const element = document.getElementById("root");
    if (element) {
        ReactDOM.render(<Moderator />, element);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderApp, { once: true });
} else {
    renderApp();
}
