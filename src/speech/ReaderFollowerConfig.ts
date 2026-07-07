// How the reader-follower turns speech transcripts into a reading position. Speech engines with speculative
// partials (the native Web Speech API, Vosk) emit interim guesses that can run a few words ahead of what was
// actually said and then get revised. Because the reading position only moves forward, such a guess can pin the
// highlight (and the buzz point) ahead of the reader -- especially on questions that repeat a phrase, where the
// guess matches a later occurrence. These modes let the user trade responsiveness against that overshoot.
//
// Set the mode from the browser DevTools console, then reload:
//   localStorage.setItem("modaq_reader_follow_mode", "finals-only");   // mode A
//   localStorage.setItem("modaq_reader_follow_mode", "confirmed");     // mode B
//   localStorage.removeItem("modaq_reader_follow_mode");               // back to default
//
//  - "interim" (default): act on every transcript, interim or final. Most responsive; can overshoot on a
//    speculative interim and, being forward-only, stay there.
//  - "finals-only" (A): ignore speculative interims; only finalized utterances move the position. No interim
//    overshoot, at the cost of updating in utterance-sized steps instead of word-by-word.
//  - "confirmed" (B): act on interims for responsiveness, but re-evaluate each utterance from the last
//    confirmed position so a revised interim that drops an earlier (mis)guess pulls the position back. Only
//    finalized utterances (and utterance boundaries) commit, so a transient interim jump is walked back unless
//    a final confirms it.
export type ReaderFollowMode = "interim" | "finals-only" | "confirmed";

const followModeKey = "modaq_reader_follow_mode";

export function getReaderFollowMode(): ReaderFollowMode {
    if (typeof window === "undefined" || window.localStorage == undefined) {
        return "interim";
    }

    const value: string | null = localStorage.getItem(followModeKey);
    return value === "finals-only" || value === "confirmed" ? value : "interim";
}
