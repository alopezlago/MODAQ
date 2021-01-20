import { SheetState } from "./SheetState";

export type IPendingSheet = Pick<SheetState, "sheetId" | "roundNumber">;
