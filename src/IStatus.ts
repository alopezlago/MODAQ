// TODO: Merge with IResult
export type IStatus = ISuccessStatus | IFailureStatus;

export interface ISuccessStatus {
    isError: false;
    status: string;
}

export interface IFailureStatus {
    isError: true;
    status: string;
}

export function isFailure(status: IStatus): status is IFailureStatus {
    return status.isError && status.status != undefined;
}

export function isSuccess(status: IStatus): status is ISuccessStatus {
    return !status.isError && status.status != undefined;
}
