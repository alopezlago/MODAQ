export interface IThrowOutQuestionDialogState {
    title: string;
    message: string;
    // The pre-computed replacement question number (1-based) shown in the SpinButton. Undefined if the packet
    // has no available replacement (user must upload more questions first).
    defaultReplacementNumber: number | undefined;
    // Upper bound for the SpinButton (total questions of this type in the packet).
    maxQuestionNumber: number;
    onConfirm: (replacementIndex: number | undefined) => void;
}
