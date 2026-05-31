export interface IMessageDialogOptions {
    title: string;
    message: string;
}

export interface IOKMessageDialogOptions extends IMessageDialogOptions {
    onOK?: () => void;
    okLabel?: string;
}

export interface IOKCancelMessageDialogOptions extends IMessageDialogOptions {
    onOK: () => void;
    okLabel?: string;
}

export interface IYesNoCancelMessageDialogOptions extends IMessageDialogOptions {
    onYes: () => void;
    onNo: () => void;
    yesLabel?: string;
    noLabel?: string;
}
