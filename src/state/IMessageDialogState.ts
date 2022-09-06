export interface IMessageDialogState {
    title: string;
    message: string;
    type: MessageDialogType;
    onOK?: () => void;
    onNo?: () => void;
}

export const enum MessageDialogType {
    OK = 0,
    OKCancel = 1,
    YesNocCancel = 2,
}
