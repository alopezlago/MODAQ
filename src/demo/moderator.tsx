import * as React from "react";
import * as ReactDOM from "react-dom";
import { initializeIcons } from "@fluentui/react";

import "./moderator.css";
import { ModaqControl } from "../components/ModaqControl";
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
    KlaxonClient,
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
    return (
        format?.massinger === true &&
        packet.tossups.length > MASSINGER_TARGET &&
        deriveSubcats(packet).length >= 2
    );
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
function useGameSync(client: KlaxonClient): (match: IMatch, inProgress?: boolean, currentQuestion?: number) => void {
    const lastKey = React.useRef<string>("");
    return React.useCallback(
        (match: IMatch, _inProgress?: boolean, currentQuestion?: number) => {
            client.massinger({ action: "modaq_game", qbj: match, currentQuestion });
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

function serverErratumToErratum(e: IServerErratum): IErratum {
    return {
        questionNumber: e.questionNumber,
        questionType: e.questionType,
        thrownOut: e.thrownOut,
        text: e.text,
        at: e.at,
    };
}

function Moderator(): JSX.Element {
    const clientRef = React.useRef<KlaxonClient | undefined>(undefined);
    const [phase, setPhase] = React.useState<
        "connecting" | "error" | "setup" | "lobby" | "pickban" | "reading" | "lite" | "account"
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
                    setFatal("Sign in with your reader account to moderate this room (the director must have added or approved you).");
                    setSignInUrl(`/account?return=${encodeURIComponent(`/modaq?room=${code}`)}`);
                } else if (error.denyReason === "not_approved" && error.state?.tournamentCode) {
                    // Known account, not approved yet: offer the request-access
                    // flow; approval needs a fresh join, so reload afterwards.
                    setRoomState(error.state);
                    setNeedsMembership(true);
                    setPhase("account");
                    return;
                } else if (error.denyReason === "not_approved") {
                    setFatal("Your account isn't approved for this tournament yet — ask the director to add you (they can use your email).");
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
        const liveRound = localStorage.getItem("bz_modaqLive:" + code);
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
            const text = await packetFile.text();
            const parsed = JSON.parse(text) as IPacket;
            if (!Array.isArray(parsed.tossups)) {
                throw new Error("That file isn't a packet (no tossups array).");
            }
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
            errata = serverErrata
                .filter((e) => (e.round ?? "") === roundLabel)
                .map(serverErratumToErratum);
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
            setPacketFile(undefined);   // going back to the tournament packet
            setSetupMsg("");
        };

        return (
            <div className="mod-center mod-setup">
                <h1>MODAQ moderator — room {code}</h1>
                {clientRef.current ? <DirectorMessages client={clientRef.current} /> : undefined}
                <p className="hint">
                    Choose the round and its packet, then start — teams are set in MODAQ&apos;s New Game dialog, and
                    you read with the Klaxon buzzer on the right.
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
                    {serverPackets.length > 0 ? "…or read your own packet file (JSON)" : "Packet file (JSON)"}
                </label>
                <input
                    id="packet"
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                        setPacketFile(e.target.files?.[0]);
                        setSetupMsg("");
                    }}
                />

                <label htmlFor="round">Round label</label>
                <input
                    id="round"
                    type="text"
                    value={round}
                    onChange={(e) => setRound(e.target.value)}
                />
                <p className="hint">
                    What this game is filed under in the tournament&apos;s stats. Picking a released round above sets
                    it for you.
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
                // The players' scoresheet belongs to the game being left.
                clientRef.current?.massinger({ action: "modaq_game", qbj: null });
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
        (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
            (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
        (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const teamNames = [teamA.trim(), teamB.trim()].filter((n) => n !== "");
    const namesReady = teamNames.length === 2 && norm(teamA) !== norm(teamB);

    const onTeam = (name: string): IRoomMember[] =>
        connected.filter((m) => norm(m.effectiveTeam) === norm(name));
    const unassigned = connected.filter(
        (m) => !teamNames.some((name) => norm(name) === norm(m.effectiveTeam))
    );

    const missingCaptains = captainsWanted
        ? teamNames.filter((name) => !onTeam(name).some((m) => m.isCaptain))
        : [];
    const emptyTeams = namesReady ? teamNames.filter((name) => onTeam(name).length === 0) : [];
    const canStart =
        namesReady && unassigned.length === 0 && (connected.length === 0 || emptyTeams.length === 0);

    const link = `${location.origin}/r/${code}`;
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
                            {unassigned.length} player{unassigned.length === 1 ? "" : "s"} still need a team — set
                            them on the right, or remove them from the room.
                        </div>
                    )}
                    {namesReady && connected.length > 0 && unassigned.length === 0 && emptyTeams.length > 0 && (
                        <div className="ms-warn">
                            Nobody is on {emptyTeams.join(" or ")} yet.
                        </div>
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
                (m.effectiveTeam ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ===
                    team.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
        );

    const teamOptions: string[] =
        gameTeams.length >= 2
            ? gameTeams.map((team) => team.name)
            : roomState?.roster?.teamNames?.slice(0, 2) ?? [];
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
                            The other team ({teamOptions[1 - firstIndex] ?? "—"}) picks second, and they alternate
                            from there. You can change whose turn it is at any point once the board is running.
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
                                No captain yet for {missingCaptains.join(" or ")} — mark one in the players list on
                                the right (or their picks will have to come from you).
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
    const secondsLeft =
        board.deadline != null ? Math.max(0, Math.ceil((board.deadline - Date.now()) / 1000)) : null;
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
                                            ★ {captainOf(board.teams[board.turn])?.rosterPlayer ||
                                                captainOf(board.teams[board.turn])?.name}
                                        </span>
                                    ) : (
                                        <span className="ms-warn-inline">
                                            no captain for {board.teams[board.turn]}
                                        </span>
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
                            Last: {board.teams[lastAction.team]} {lastAction.type === "protect" ? "protected" : "banned"}{" "}
                            <strong>{lastAction.label}</strong>
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
                        <button disabled={board.actions.length === 0} onClick={() => send({ action: "massinger_undo" })}>
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
            await navigator.clipboard.writeText(`${location.origin}/r/${props.code}`);
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

    const onGameUpdate = React.useCallback(
        (qbj: IMatch, inProgress?: boolean, currentQuestion?: number) => {
            try {
                localStorage.setItem("bz_modaqLive:" + code, round);
            } catch {
                /* storage may be unavailable; resume is best-effort */
            }
            syncGame(qbj, inProgress, currentQuestion);
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

    // Judging a buzz in MODAQ (correct or wrong) resolves the current buzz, so
    // clear the Klaxon buzzer — same as pressing "r" in the panel.
    const onBuzzJudged = React.useCallback(() => client.resetBuzzer(), [client]);

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
                </RoomToolbar>
                <DirectorMessages client={client} />
                <ModaqControl
                    applyStylingToRoot={false}
                    buildVersion={__BUILD_VERSION__}
                    newGameOnLoad={{
                        packet: config.packet,
                        packetName: `Round ${round}`,
                        rosters: config.rosters,
                        teams: config.teams,
                    }}
                    newGameNotice={
                        config.board ? (
                            <PickBanSummary board={config.board} onEdit={config.onEditPickBan} />
                        ) : undefined
                    }
                    gameFormat={config.gameFormat}
                    persistState={true}
                    storeName={`klaxon-${code}-${round}`}
                    errata={config.errata}
                    onErrataChange={onErrataChange}
                    onGameUpdate={onGameUpdate}
                    onBuzzJudged={onBuzzJudged}
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
    const onBuzzJudged = React.useCallback(() => client.resetBuzzer(), [client]);
    // Lite mode has no tournament roster, but the teams entered in MODAQ's own
    // New Game dialog still link the buzzers to real players, and the room
    // still gets the live scoresheet.
    const syncGame = useGameSync(client);
    return (
        <div className="mod-shell">
            <div className="mod-main">
                <RoomToolbar code={code} label={`Room ${code} · MODAQ lite`} />
                <DirectorMessages client={client} />
                <ModaqControl
                    applyStylingToRoot={false}
                    buildVersion={__BUILD_VERSION__}
                    persistState={true}
                    storeName={`klaxon-lite-${code}`}
                    onGameUpdate={syncGame}
                    onBuzzJudged={onBuzzJudged}
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
            try { await KlaxonApi.me(); isIn = true; } catch { localStorage.removeItem("bz_sessionToken"); }
        }
        setLoggedIn(isIn);
        if (isIn) {
            try {
                const a = await KlaxonApi.getAccess(tcode);
                const effective = strict ? a.memberStatus ?? null : a.status;
                setStatus(effective);
                if (effective === "approved") { onApproved(); return; }
            } catch { /* ignore */ }
        }
        setChecking(false);
    }, [tcode, onApproved, strict]);

    React.useEffect(() => { refresh(); }, [refresh]);

    const submit = async (): Promise<void> => {
        setMsg("");
        try {
            if (mode === "register") await KlaxonApi.register(username.trim(), password);
            else await KlaxonApi.login(username.trim(), password);
            setPassword("");
            await refresh();
        } catch (e) {
            setMsg((e as Error).message === "username_taken" ? "That username is taken." :
                (e as Error).message === "bad_credentials" ? "Wrong username or password." :
                (e as Error).message === "bad_password" ? "Password must be at least 6 characters." :
                (e as Error).message === "bad_username" ? "Username must be 3–30 letters/numbers." :
                "Could not sign in: " + (e as Error).message);
        }
    };

    const request = async (): Promise<void> => {
        setMsg("");
        try { const r = await KlaxonApi.requestAccess(tcode); setStatus(r.status); }
        catch (e) { setMsg("Could not request access: " + (e as Error).message); }
    };

    const logout = (): void => { localStorage.removeItem("bz_sessionToken"); setLoggedIn(false); setStatus(null); };

    if (checking) {
        return <div className="mod-center"><p>Checking access…</p></div>;
    }

    if (!loggedIn) {
        return (
            <div className="mod-center mod-setup">
                <h1>Reader sign-in</h1>
                <p className="hint">This tournament requires an approved reader account to read its packets.</p>
                <div className="schedule-rounds">
                    <button onClick={() => setMode("login")} disabled={mode === "login"}>Log in</button>
                    <button onClick={() => setMode("register")} disabled={mode === "register"}>Create account</button>
                </div>
                <label htmlFor="acct-user">Username</label>
                <input id="acct-user" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
                <label htmlFor="acct-pass">Password</label>
                <input id="acct-pass" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
                <div>
                    <button className="primary" onClick={submit}>{mode === "register" ? "Create account" : "Log in"}</button>
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
                    <p>Your request is <strong>pending</strong> the tournament director&apos;s approval.</p>
                    <div><button className="primary" onClick={refresh}>Check again</button></div>
                </>
            )}
            {status === "denied" && <p className="msg">Your access request was denied by the director.</p>}
            {(status == null) && (
                <>
                    <p>You&apos;re signed in. Request access to read this tournament&apos;s packets.</p>
                    <div><button className="primary" onClick={request}>Request access</button></div>
                </>
            )}
            <p className="msg">{msg}</p>
            <p className="hint"><a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Sign out</a></p>
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
