export type IResult<T> = ISuccessResult<T> | IFailureResult;

export interface ISuccessResult<T> {
    success: true;
    value: T;
}

export interface IFailureResult {
    success: false;
    message: string;
}

export function isFailure<T>(result: IResult<T>): result is IFailureResult {
    return !result.success && result.message != undefined;
}

export function isSuccess<T>(result: IResult<T>): result is ISuccessResult<T> {
    return result.success;
}
