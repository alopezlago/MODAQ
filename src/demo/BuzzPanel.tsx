import * as React from "react";
import { IPublicRoomState, KlaxonClient } from "./klaxonClient";

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

export function BuzzPanel(props: { client: KlaxonClient; state: IPublicRoomState | undefined }): JSX.Element {
    const { client, state } = props;

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
    const queueMode = !!state?.settings?.queueMode;
    const players = (state?.members ?? []).filter((m) => m.role === "player");
    const offline = players.filter((p) => !p.connected).length;

    return (
        <div className="klaxon-buzz">
            <h2 className="klaxon-buzz-title">Buzzer</h2>

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
