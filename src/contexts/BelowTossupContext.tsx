import React from "react";

// Something the host wants shown right under the tossup's words, above the answer line — where the reader's eyes
// already are. Klaxon puts each typed answer there as it is submitted. Nothing is shown when the host gives nothing.
export const BelowTossupContext = React.createContext<React.ReactNode>(undefined);
