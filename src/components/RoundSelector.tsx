import * as React from "react";
import { observer } from "mobx-react-lite";
import { SpinButton } from "@fluentui/react";

const defaultMaximumRoundNumber = 30;

export const RoundSelector = observer(function RoundSelector(props: IRoundSelectorProps): JSX.Element {
    const maximumRoundNumber: number = props.maximumRoundNumber ?? defaultMaximumRoundNumber;

    return (
        <SpinButton
            label="Round Number"
            onIncrement={(newValue: string) => roundNumberIncrementHandler(props, maximumRoundNumber, newValue)}
            onDecrement={(newValue: string) => roundNumberDecrementHandler(props, newValue)}
            onValidate={(newValue: string) => roundNumberChangeHandler(props, maximumRoundNumber, newValue)}
            disabled={props.disabled}
            value={props.roundNumber.toString()}
            min={1}
            max={props.maximumRoundNumber ?? defaultMaximumRoundNumber}
            step={1}
            incrementButtonAriaLabel={"Increase round number by 1"}
            decrementButtonAriaLabel={"Decrease round number by 1"}
        />
    );
});

function roundNumberChangeHandler(
    props: IRoundSelectorProps,
    maximumRoundNumber: number,
    newValue: string
): string | void {
    if (newValue == undefined) {
        return;
    }

    const roundNumber: number = parseInt(newValue, 10);
    if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > maximumRoundNumber) {
        // Don't accept the input if it's not a number
        return;
    }

    props.onRoundNumberChange(roundNumber);
    return roundNumber.toString();
}

function roundNumberDecrementHandler(props: IRoundSelectorProps, newValue: string): string | void {
    const roundNumber: number = parseInt(newValue, 10);
    if (isNaN(roundNumber) || roundNumber <= 1) {
        return;
    }

    const newRoundNumber: number = roundNumber - 1;
    props.onRoundNumberChange(newRoundNumber);
    return newRoundNumber.toString();
}

function roundNumberIncrementHandler(
    props: IRoundSelectorProps,
    maximumRoundNumber: number,
    newValue: string
): string | void {
    const roundNumber: number = parseInt(newValue, 10);
    if (isNaN(roundNumber) || roundNumber >= maximumRoundNumber) {
        return;
    }

    const newRoundNumber: number = roundNumber + 1;
    props.onRoundNumberChange(newRoundNumber);
    return newRoundNumber.toString();
}

export interface IRoundSelectorProps {
    disabled?: boolean;
    maximumRoundNumber?: number;
    roundNumber: number;
    onRoundNumberChange(newRoundNumber: number): void;
}
