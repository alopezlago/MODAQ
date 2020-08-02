import * as React from "react";
import { observer } from "mobx-react";
import { Label } from "@fluentui/react/lib/Label";
import { createUseStyles } from "react-jss";
import { CancelButton } from "../CancelButton";

// TODO: Think on how to make this keyboard friendly
export const CycleItem = observer(
    (props: ICycleItemProps): JSX.Element => {
        const classes: ICycleItemStyle = useStyle();
        const deleteButton: JSX.Element | undefined =
            props.onDelete != undefined ? <CancelButton title="Delete" onClick={props.onDelete} /> : undefined;

        return (
            <div className={classes.eventContainer}>
                <Label className={classes.eventText}>{props.text}</Label>
                {deleteButton}
            </div>
        );
    }
);

// TODO: CycleItem should be generic (accept an event as the generic argument), and onDelete should pass in the cycle and
// that event. That way we just need one function for it.
export interface ICycleItemProps {
    text: string;
    onDelete?: () => void;
}

interface ICycleItemStyle {
    eventContainer: string;
    eventText: string;
}

const useStyle: (data?: unknown) => ICycleItemStyle = createUseStyles({
    eventContainer: {
        marginBottom: 5,
    },
    eventText: {
        display: "inline",
    },
});
