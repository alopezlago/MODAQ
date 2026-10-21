// Experimental: the moderator's post-round scorecard on Klaxon's moderator page. Turned on per screen from MODAQ's
// menu ("Moderator scorecard (experimental)"); off for everyone until then. Combines what this screen timed
// (MODAQ's src/scorecard) with what the room saw (GET /api/rooms/:code/scorecard). Only the moderator sees it.

import * as React from "react";

import { buildRoundScorecard, bonusPartReferenceMs, IRoundScorecard, ITimedItem } from "../scorecard/RoundScorecard";
import { clearRoundTiming, getRoundTiming, IRoundTimingLog } from "../scorecard/RoundTiming";

interface IRoomRoundSummary {
    buzzes: number;
    acceptedBuzzes: number;
    buzzToRuling: { count: number; medianMs: number | null; slowest: { question: number | null; ms: number }[] };
    accidentalClears: number;
    undoneClears: number;
    withdrawals: { count: number; byPlayer: number; free: number };
    stuckAlerts: number;
    protests: { count: number; byStatus: Record<string, number> };
    errata: { count: number; thrownOut: number };
}

export interface IScorecard {
    // Where this game's timings are filed (ModaqControl's roundTimingKey)
    key: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    // The toolbar button and the panel it opens; nothing while the scorecard is off
    button: JSX.Element | null;
    panel: JSX.Element | null;
}

/**
 * One game's scorecard. `game` names the game within the room (a round, a packet), so each gets its own timings.
 */
export function useScorecard(code: string, token: string | null, game: string, round: string | null): IScorecard {
    const key = `klaxon-${code}-${game}`;
    const [enabled, setEnabled] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const onChange = React.useCallback((on: boolean) => {
        setEnabled(on);
        if (!on) {
            setOpen(false);
        }
    }, []);

    const button: JSX.Element | null = enabled ? (
        <button
            onClick={() => setOpen((v) => !v)}
            title="Timing, rulings and reading for this round. Only you see it."
        >
            {open ? "Hide your round" : "Your round"}
        </button>
    ) : null;
    const panel: JSX.Element | null =
        enabled && open ? (
            <ScorecardPanel code={code} token={token} timingKey={key} round={round} onClose={() => setOpen(false)} />
        ) : null;
    return { key, enabled, onChange, button, panel };
}

function ScorecardPanel(props: {
    code: string;
    token: string | null;
    timingKey: string;
    round: string | null;
    onClose: () => void;
}): JSX.Element {
    const { code, token, timingKey, round } = props;
    const [refreshes, setRefreshes] = React.useState(0);
    // The log is the recorder's live object, so it's re-read (and the card rebuilt) on every refresh
    const [timing, card]: [IRoundTimingLog | undefined, IRoundScorecard | undefined] = React.useMemo(() => {
        const log: IRoundTimingLog | undefined = getRoundTiming(timingKey);
        return [log, log == undefined ? undefined : buildRoundScorecard(log)];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timingKey, refreshes]);
    const startedAt: number = timing?.startedAt ?? 0;

    const [room, setRoom] = React.useState<IRoomRoundSummary | undefined>();
    const [roomError, setRoomError] = React.useState("");
    React.useEffect(() => {
        let cancelled = false;
        const sessionToken: string = localStorage.getItem("bz_sessionToken") || "";
        const params = new URLSearchParams({ token: token || "", sessionToken, since: String(startedAt) });
        if (round != null) {
            params.set("round", round);
        }

        fetch(`/api/rooms/${code}/scorecard?${params.toString()}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
            .then((summary: IRoomRoundSummary) => !cancelled && setRoom(summary))
            .catch((error: Error) => !cancelled && setRoomError(error.message));
        return () => {
            cancelled = true;
        };
    }, [code, token, round, startedAt, refreshes]);

    return (
        <div className="mod-prev mod-scorecard" role="dialog" aria-label="Your round">
            <div className="sc-head">
                <h3>
                    Your round <span className="sc-tag">experimental</span>
                </h3>
                <span className="sc-actions">
                    <button onClick={() => setRefreshes((n) => n + 1)}>Refresh</button>
                    <button onClick={props.onClose}>Close</button>
                </span>
            </div>
            <p className="hint">
                Only you see this. Reading numbers are pointers, not errors.
            </p>

            {card == undefined || card.questionsShown === 0 ? (
                <p>Nothing timed yet.</p>
            ) : (
                <>
                    <section>
                        <h4>Rhythm</h4>
                        <dl>
                            <Row label="Questions" value={String(card.questionsShown)} />
                            {card.roundMs != undefined && <Row label="Round so far" value={clock(card.roundMs)} />}
                            <Summary
                                label="Between questions"
                                summary={card.betweenQuestions}
                                note="From the end of one question to the first word of the next"
                                showTotal={true}
                            />
                        </dl>
                    </section>

                    <section>
                        <h4>Time given to answer</h4>
                        <dl>
                            <Summary
                                label="Tossups, after recognizing"
                                summary={card.tossupAnswerWait}
                                note="From the buzz (or Space) to the ruling"
                            />
                            <Summary
                                label="Bonus parts"
                                summary={card.bonusPartWait}
                                note={
                                    card.bonusPartWait.count === 0
                                        ? "Needs read-along and the bonus on screen"
                                        : `From the end of each part to reading on. ${
                                              card.bonusPartWait.overReference
                                          } over ${seconds(bonusPartReferenceMs)}`
                                }
                            />
                            {card.rulingHeardToEntered.count > 0 && (
                                <Summary
                                    label="Saying the ruling to entering it"
                                    summary={card.rulingHeardToEntered}
                                    note={'From read-along hearing "correct"/"neg" to the ruling in MODAQ'}
                                />
                            )}
                        </dl>
                    </section>

                    <section>
                        <h4>Reading</h4>
                        {card.reading == undefined ? (
                            <p className="hint">{card.readingHiddenBecause}</p>
                        ) : (
                            <dl>
                                <Row
                                    label="Heard"
                                    value={`${card.reading.tossupsHeard} tossups (${Math.round(
                                        card.reading.coverage * 100
                                    )}%)`}
                                />
                                {card.reading.wordsPerMinute != undefined && (
                                    <Row
                                        label="Pace"
                                        value={`${Math.round(card.reading.wordsPerMinute)} words a minute`}
                                        note={drift(card.reading.paceDrift)}
                                    />
                                )}
                                {card.reading.sentenceSeconds.count > 0 && (
                                    <Row
                                        label="Sentence to sentence"
                                        value={`${seconds(card.reading.sentenceSeconds.medianMs)} per sentence, ${(
                                            card.reading.sentenceWordsPerSecond ?? 0
                                        ).toFixed(1)} words a second`}
                                        note={giveaway(card.reading.lastSentencePaceRatio)}
                                    />
                                )}
                                {card.reading.slowestSentences.length > 0 && (
                                    <Row
                                        label="Slowest sentences"
                                        value={card.reading.slowestSentences
                                            .map(
                                                (s) =>
                                                    `Q${s.question} sentence ${s.sentence}: ${seconds(
                                                        s.ms
                                                    )} for ${s.words} words`
                                            )
                                            .join(" · ")}
                                    />
                                )}
                                <Items label="Long pauses" items={card.reading.longPauses} empty="None over 2 s" />
                                <Items
                                    label="Kept reading after a buzz"
                                    items={card.reading.keptReading}
                                    empty="Never"
                                />
                                {card.reading.buzzNudgeMedian != undefined && (
                                    <Row
                                        label="Buzz points"
                                        value={nudge(card.reading.buzzNudgeMedian)}
                                        note={`Saved word vs. read-along, over ${card.reading.buzzNudges} buzzes`}
                                    />
                                )}
                            </dl>
                        )}
                    </section>
                </>
            )}

            <section>
                <h4>In the room</h4>
                {room == undefined ? (
                    <p className="hint">{roomError ? `Couldn't load the room's side: ${roomError}` : "Loading…"}</p>
                ) : (
                    <dl>
                        <Row label="Buzzes" value={`${room.acceptedBuzzes} accepted of ${room.buzzes}`} />
                        {room.buzzToRuling.medianMs != null && (
                            <Row
                                label="Players waited for a ruling"
                                value={`${seconds(room.buzzToRuling.medianMs)} typical`}
                                note={
                                    room.buzzToRuling.slowest.length
                                        ? `Longest: ${room.buzzToRuling.slowest
                                              .map((w) => `${w.question ? `Q${w.question} ` : ""}${seconds(w.ms)}`)
                                              .join(", ")}`
                                        : undefined
                                }
                            />
                        )}
                        <Row
                            label="Buzzer clears"
                            value={`${room.accidentalClears} without a ruling, ${room.undoneClears} undone`}
                        />
                        <Row
                            label="Withdrawals"
                            value={
                                room.withdrawals.count === 0
                                    ? "None"
                                    : `${room.withdrawals.count} (${room.withdrawals.byPlayer} by the player)`
                            }
                        />
                        {room.stuckAlerts > 0 && <Row label='"Is the buzzer stuck?"' value={String(room.stuckAlerts)} />}
                        <Row
                            label="Protests"
                            value={
                                room.protests.count === 0
                                    ? "None"
                                    : Object.entries(room.protests.byStatus)
                                          .map(([status, n]) => `${n} ${status}`)
                                          .join(", ")
                            }
                        />
                        <Row
                            label="Errata you flagged"
                            value={
                                room.errata.count === 0
                                    ? "None"
                                    : `${room.errata.count}${
                                          room.errata.thrownOut ? ` (${room.errata.thrownOut} thrown out)` : ""
                                      }`
                            }
                        />
                    </dl>
                )}
            </section>

            {timing != undefined && (
                <p className="sc-foot">
                    <button
                        onClick={() => {
                            clearRoundTiming(timingKey);
                            setRefreshes((n) => n + 1);
                        }}
                    >
                        Clear this round&apos;s timings
                    </button>
                </p>
            )}
        </div>
    );
}

function Row(props: { label: string; value: string; note?: string }): JSX.Element {
    return (
        <>
            <dt>{props.label}</dt>
            <dd>
                {props.value}
                {props.note && <span className="sc-note">{props.note}</span>}
            </dd>
        </>
    );
}

function Summary(props: {
    label: string;
    summary: { count: number; medianMs?: number; averageMs?: number; totalMs?: number; longest: ITimedItem[] };
    note?: string;
    showTotal?: boolean;
}): JSX.Element {
    const { summary } = props;
    if (summary.count === 0) {
        return <Row label={props.label} value="Not measured" note={props.note} />;
    }

    const parts: string[] = [`${seconds(summary.averageMs)} average`, `${seconds(summary.medianMs)} typical`];
    if (props.showTotal && summary.totalMs != undefined) {
        parts.push(`${clock(summary.totalMs)} in all`);
    }

    const longest: string = summary.longest.length ? `Longest: ${summary.longest.map(item).join(", ")}. ` : "";
    return (
        <Row label={`${props.label} (${summary.count})`} value={parts.join(" · ")} note={longest + (props.note ?? "")} />
    );
}

function Items(props: { label: string; items: ITimedItem[]; empty: string }): JSX.Element {
    return <Row label={props.label} value={props.items.length ? props.items.map(item).join(" · ") : props.empty} />;
}

const item = (i: ITimedItem): string => `Q${i.question} ${seconds(i.ms)}${i.detail ? ` (${i.detail})` : ""}`;

function seconds(ms: number | null | undefined): string {
    if (ms == undefined) {
        return "—";
    }

    return ms >= 60000 ? clock(ms) : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
}

function clock(ms: number): string {
    const total: number = Math.round(ms / 1000);
    const h: number = Math.floor(total / 3600);
    const m: number = Math.floor((total % 3600) / 60);
    const s: string = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function drift(ratio: number | undefined): string | undefined {
    if (ratio == undefined || Math.abs(ratio - 1) < 0.08) {
        return ratio == undefined ? undefined : "Steady through the round";
    }

    return `${Math.round(Math.abs(ratio - 1) * 100)}% ${ratio > 1 ? "faster" : "slower"} in the second half`;
}

function giveaway(ratio: number | undefined): string | undefined {
    if (ratio == undefined) {
        return undefined;
    }

    if (Math.abs(ratio - 1) < 0.1) {
        return "Last sentences read at the same pace as the rest";
    }

    return `Last sentence before the buzz read ${Math.round(Math.abs(ratio - 1) * 100)}% ${
        ratio > 1 ? "faster" : "slower"
    } than the rest`;
}

function nudge(median: number): string {
    const words: number = Math.round(median);
    if (words === 0) {
        return "Read-along puts buzzes on the right word";
    }

    return `Saved ${Math.abs(words)} word${Math.abs(words) === 1 ? "" : "s"} ${
        words > 0 ? "after" : "before"
    } read-along. Try a buzz point offset of ${words > 0 ? "+" : ""}${words} in Options.`;
}

// Timings from games over a fortnight old are dropped, so they don't pile up in this browser
export function pruneOldRoundTimings(): void {
    try {
        const cutoff: number = Date.now() - 14 * 24 * 60 * 60 * 1000;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const storageKey: string | null = localStorage.key(i);
            if (storageKey?.startsWith("modaq-round-timing:")) {
                const log = getRoundTiming(storageKey.slice("modaq-round-timing:".length));
                if (log == undefined || log.startedAt < cutoff) {
                    localStorage.removeItem(storageKey);
                }
            }
        }
    } catch {
        // Storage unavailable: nothing to prune
    }
}
