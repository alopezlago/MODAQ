import * as GameFormats from "./GameFormats";
import { IMatch } from "../qbj/QBJ";
import { PacketState } from "./PacketState";
import { makeAutoObservable } from "mobx";
import { CustomizeGameFormatState } from "./CustomizeGameFormatState";
import { IStatus } from "../IStatus";

export class ImportFromQBJDialogState {
    public customizeGameFormat: CustomizeGameFormatState;

    public match: IMatch | undefined;

    public packet: PacketState | undefined;

    public pivotKey: ImportFromQBJPivotKey;

    public qbjStatus: IStatus | undefined;

    public convertErrorMessage: string | undefined;

    constructor() {
        makeAutoObservable(this);

        // TODO: Game format should come from the constructor
        this.customizeGameFormat = new CustomizeGameFormatState(GameFormats.ACFGameFormat);
        this.match = undefined;
        this.packet = undefined;
        this.pivotKey = ImportFromQBJPivotKey.Match;
        this.qbjStatus = undefined;
        this.convertErrorMessage = undefined;
    }

    public resetConvertErrorMessage(): void {
        this.convertErrorMessage = undefined;
    }

    public resetQbjStatus(): void {
        this.qbjStatus = undefined;
    }

    public setConvertErrorMessage(message: string, newPivotKey?: ImportFromQBJPivotKey): void {
        this.convertErrorMessage = message;

        if (newPivotKey != undefined) {
            this.setPivotKey(newPivotKey);
        }
    }

    public setMatch(match: IMatch): void {
        this.match = match;
        this.qbjStatus = {
            isError: false,
            status: `${this.match.match_teams.map((team) => team.team.name).join(" vs. ")} loaded`,
        };
    }

    public setPacket(packet: PacketState): void {
        this.packet = packet;
    }

    public setPivotKey(pivotKey: ImportFromQBJPivotKey): void {
        this.pivotKey = pivotKey;
    }

    public setQbjStatus(status: IStatus): void {
        this.qbjStatus = status;
    }
}

export const enum ImportFromQBJPivotKey {
    Match = "M",
    Packet = "P",
    Format = "F",
}
