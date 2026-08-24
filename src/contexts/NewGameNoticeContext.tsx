import * as React from "react";

/**
 * Lets the host put its own content at the top of MODAQ's New Game dialog — a summary of whatever the host decided
 * before the game starts, plus any controls to go back and change it. MODAQ renders it and knows nothing about what
 * it means. Klaxon uses it for the MASSINGER pick/ban result: which subcategories were protected and banned, and a
 * way back to the pick/ban screen if something needs fixing before the game begins.
 */
export const NewGameNoticeContext: React.Context<INewGameNoticeContextValue> =
    React.createContext<INewGameNoticeContextValue>({});

export interface INewGameNoticeContextValue {
    notice?: React.ReactNode;
}
