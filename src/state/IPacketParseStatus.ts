import { IStatus } from "../IStatus";

export interface IPacketParseStatus {
    status: IStatus;
    warnings: string[];
}
