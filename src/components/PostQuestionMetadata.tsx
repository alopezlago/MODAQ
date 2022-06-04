import * as React from "react";
import { observer } from "mobx-react-lite";
import { mergeStyleSets } from "@fluentui/react";

import { AppState } from "../state/AppState";
import { StateContext } from "../contexts/StateContext";

export const PostQuestionMetadata = observer(function PostQuestionMetadata(
    props: IPostQuestionMetadataProps
): JSX.Element {
    const appState: AppState = React.useContext(StateContext);
    if (!props.metadata) {
        return <></>;
    }

    const classNames: IPostQuestionMetadataClassNames = getClassNames(appState.uiState.questionFontSize);
    return <div className={classNames.metadata}>{`<${props.metadata}>`}</div>;
});

export interface IPostQuestionMetadataProps {
    metadata: string | undefined;
}

export interface IPostQuestionMetadataClassNames {
    metadata: string;
}

const getClassNames = (fontSize: number): IPostQuestionMetadataClassNames =>
    mergeStyleSets({
        metadata: {
            fontSize: fontSize > 2 ? fontSize - 2 : fontSize,
        },
    });
