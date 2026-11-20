import * as React from "react";
import { observer } from "mobx-react-lite";
import { IIconProps, ITheme, memoizeFunction, mergeStyleSets, ThemeContext } from "@fluentui/react";
import { IconButton } from "@fluentui/react/lib/Button";

import * as ErrataDialogController from "./dialogs/ErrataDialogController";
import { AppState } from "../state/AppState";
import { useAppState } from "../contexts/StateContext";
import { IErratum, QuestionType } from "../state/IErratum";

const errataIconProps: IIconProps = { iconName: "Flag" };

// Lets the moderator mark an error in the question they're reading (R does the same for the current question). It
// sits in the question's top-right corner (next to the throw-out button), and fills in once the question is marked.
// Details are added in the errata review at the end of the round.
export const ErrataButton = observer(function ErrataButton(props: IErrataButtonProps): JSX.Element {
    const appState: AppState = useAppState();

    const erratum: IErratum | undefined = appState.errata.getErratum(props.questionNumber, props.questionType);
    const questionName = `${props.questionType === "bonus" ? "bonus" : "tossup"} ${props.questionNumber}`;
    const tooltip: string = getTooltip(questionName, erratum);

    // Only marks the question; the moderator adds details at the end of the round
    const onClick: () => void = () =>
        ErrataDialogController.toggleMark(appState, props.questionNumber, props.questionType);

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classes: IErrataButtonClassNames = getClassNames(theme, erratum != undefined);

                return (
                    <IconButton
                        ariaLabel={tooltip}
                        className={classes.errataButton}
                        iconProps={errataIconProps}
                        title={tooltip}
                        onClick={onClick}
                    />
                );
            }}
        </ThemeContext.Consumer>
    );
});

function getTooltip(questionName: string, erratum: IErratum | undefined): string {
    if (erratum == undefined) {
        return `Mark an erratum for ${questionName} (R)`;
    }

    const text: string = erratum.text.trim();
    if (text.length === 0) {
        return `Erratum marked for ${questionName}. Add details at the end of the round, or click to unmark.`;
    }

    return `Erratum for ${questionName}: ${text}`;
}

export interface IErrataButtonProps {
    questionNumber: number;
    questionType: QuestionType;
}

interface IErrataButtonClassNames {
    errataButton: string;
}

const getClassNames = memoizeFunction(
    (theme: ITheme | undefined, hasErratum: boolean): IErrataButtonClassNames =>
        mergeStyleSets({
            errataButton: [
                {
                    display: "inline",
                    "&:hover": {
                        opacity: 1,
                    },
                },
                hasErratum
                    ? {
                          color: theme ? theme.palette.themePrimary : "rgba(0, 90, 158)",
                          "&:hover": {
                              color: theme ? theme.palette.themePrimary : "rgba(0, 90, 158)",
                          },
                      }
                    : {
                          opacity: 0.6,
                      },
            ],
        })
);
