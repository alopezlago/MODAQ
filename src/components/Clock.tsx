import * as React from "react";
import { observer } from "mobx-react-lite";

import { Text } from "@fluentui/react";

export const Clock: (props: IClockProps) => React.ReactElement = observer(function Clock(props) {
    const [date, setDate] = React.useState(new Date().toLocaleTimeString());

    React.useEffect(() => {
        const id = setInterval(() => setDate(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(id);
    });

    return <Text className={props.className}>{date}</Text>;
});

export interface IClockProps {
    className?: string;
}
