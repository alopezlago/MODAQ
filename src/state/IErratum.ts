// A moderator-reported correction for a packet question. Errata are kept
// independent of the game/scoring state (they describe the *packet*, not the
// match events), and are surfaced to the host app via ModaqControl's
// onErrataChange callback so they can be saved with the tournament.
export interface IErratum {
    /**
     * 1-based number of the question in the packet.
     */
    questionNumber: number;

    /**
     * Whether the erratum applies to the tossup or the bonus at that number.
     */
    questionType: "tossup" | "bonus";

    /**
     * If true, the question should be thrown out / not counted.
     */
    thrownOut: boolean;

    /**
     * A free-text description of the error and/or correction.
     */
    text: string;

    /**
     * When the erratum was recorded (epoch ms). Optional; set by the host.
     */
    at?: number;
}
