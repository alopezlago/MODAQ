import React from "react";
import { IErratum } from "../state/IErratum";

// Errata are managed as plain React state at the ModaqControl level (not in the
// mobx AppState) so they stay independent of game persistence, then shared down
// to the errata UI through this context.
export interface IErrataContextValue {
    errata: IErratum[];

    /**
     * Add or replace the erratum for a given question (keyed by number + type).
     */
    setErratum: (erratum: IErratum) => void;

    /**
     * Remove any erratum for the given question.
     */
    removeErratum: (questionNumber: number, questionType: "tossup" | "bonus") => void;
}

export const ErrataContext = React.createContext<IErrataContextValue | undefined>(undefined);

export function useErrata(): IErrataContextValue | undefined {
    return React.useContext(ErrataContext);
}
