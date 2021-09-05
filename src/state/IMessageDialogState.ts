export interface IMessageDialogState {
    title: string;
    message: string;
    onOK?: () => void;
}
