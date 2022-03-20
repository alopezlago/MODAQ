import * as React from "react";
import { Text } from "@fluentui/react";

export const Clock: (props: IClockProps) => React.ReactElement = (props) => {
    const [date, setDate] = React.useState(new Date().toLocaleTimeString());

    React.useEffect(() => {
        const id = setInterval(() => setDate(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(id);
    });

    return <Text className={props.className}>{date}</Text>;
};

export interface IClockProps {
    className?: string;
}
