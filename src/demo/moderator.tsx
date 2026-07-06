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
        displayName: format.tossupScheme + (format.hasBonuses ? "" : " (no bonuses)"),
    };
}

// Filled in by vite (see vite.moderator.config.ts).
declare const __BUILD_VERSION__: string;

initializeIcons();

const code: string = (new URLSearchParams(location.search).get("room") || "").toUpperCase();

interface IReadingConfig {
    packet: IPacket;
    // Roster player pool passed to MODAQ's New Game dialog (its "From QBJ
    // Registration" tab); teams and player order are chosen there natively.
    rosters: IPlayer[];
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
    const [phase, setPhase] = React.useState<"connecting" | "error" | "setup" | "reading" | "lite" | "account">("connecting");
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
            const packet = await KlaxonApi.getPacket<IPacket>(code, client.token, liveRound);
            if (!Array.isArray(packet.tossups)) {
                return false;
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
        format: ITournamentFormat | undefined
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
            await enterReading(client, roundLabel, packet, freshRoster ?? rosterPlayers, tournamentFormat);
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
        const packetReady = !!packetFile || serverPackets.indexOf(round.trim()) >= 0;
        const canStart = !starting && packetReady;
        return (
            <div className="mod-center mod-setup">
                <h1>MODAQ moderator — room {code}</h1>
                {clientRef.current ? <DirectorMessages client={clientRef.current} /> : undefined}
                <p className="hint">
                    Pick the round and packet, then set teams in MODAQ&apos;s New Game dialog and read with the Klaxon
                    buzzer on the right.
                </p>

                {scheduledRounds.length > 0 && (
                    <>
                        <label>Scheduled rounds for this room</label>
                        <div className="schedule-rounds">
                            {scheduledRounds.map((r) => (
                                <button key={r} onClick={() => setRound(r)}>
                                    Round {r}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                <label htmlFor="round">Round label</label>
                <input id="round" type="text" value={round} onChange={(e) => setRound(e.target.value)} />

                {serverPackets.length > 0 && (
                    <>
                        <label>Released rounds (packet ready)</label>
                        <div className="schedule-rounds">
                            {serverPackets.map((r) => (
                                <button key={r} onClick={() => setRound(r)}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </>
                )}

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

                {serverPackets.length > 0 ? (
                    <p className="hint">
                        {serverPackets.indexOf(round.trim()) >= 0
                            ? `Using the tournament packet for round “${round.trim()}”.`
                            : "Choose one of the released rounds above."}
                    </p>
                ) : (
                    <>
                        <label htmlFor="packet">Packet for this round (JSON)</label>
                        <input
                            id="packet"
                            type="file"
                            accept=".json,application/json"
                            onChange={(e) => setPacketFile(e.target.files?.[0])}
                        />
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
                setPhase("setup");
            }}
        />
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
    const onGameUpdate = React.useCallback(
        (qbj: IMatch, inProgress?: boolean, currentQuestion?: number) => {
            try {
                localStorage.setItem("bz_modaqLive:" + code, round);
            } catch {
                /* storage may be unavailable; resume is best-effort */
            }
            KlaxonApi.saveExport(code, token, round, qbj, inProgress === true, currentQuestion).catch(() => {
                /* transient failures self-heal on the next change */
            });
        },
        [code, token, round]
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
                    }}
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
