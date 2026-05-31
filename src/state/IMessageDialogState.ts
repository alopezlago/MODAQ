export interface IMessageDialogState {
    title: string;
    message: string;
    type: MessageDialogType;
    onOK?: () => void;
    onNo?: () => void;
    okLabel?: string;
    yesLabel?: string;
    noLabel?: string;
}

export const enum MessageDialogType {
    OK = 0,
    OKCancel = 1,
    YesNocCancel = 2,
}
